import "server-only";

import type { Prisma, Webhook, WebhookDelivery } from "@prisma/client";

import { logger } from "@/lib/logger";
import { DEFAULT_RETRY_POLICY, computeBackoffMs, shouldRetry } from "@/lib/jobs";
import type { DomainEventName, DomainEventPayload } from "@/lib/events/types";
import { buildSignatureHeader, SIGNATURE_HEADER } from "@/features/webhooks/sign";
import {
  createWebhookDelivery,
  findWebhookForDispatch,
  listActiveWebhooksForEvent,
  listDueDeliveries,
  updateWebhookDelivery,
} from "@/features/webhooks/repository";

/**
 * Outbound webhook dispatcher (§21.7) — the event bus's second consumer,
 * alongside the Automation engine's `fireTrigger` ("same event taxonomy, two
 * consumers"). For each business event: fan out to the org's active, subscribed
 * webhooks → one `WebhookDelivery` row per target (PENDING) → HMAC-signed POST
 * → SUCCESS, or FAILED with a backoff-scheduled `nextRetryAt`, capped at the
 * shared retry policy's 5 attempts — the same §11.10 shape email retry uses,
 * on the same `lib/jobs` backoff math.
 *
 * Retries drain lazily: every dispatch also re-attempts a bounded batch of due
 * deliveries (any webhook, any org — the delivery's parent webhook carries its
 * tenant), so a transiently-down receiver catches up as soon as the platform
 * is active again, without a cron. `processDueWebhookDeliveries` is exported
 * for the future scheduled runner (§15.13's cron enabler serves both surfaces).
 *
 * Like every side-effect consumer, this module never throws into the business
 * action that published the event.
 */

const DELIVERY_TIMEOUT_MS = 10_000;
const DRAIN_BATCH = 25;

/** Deterministic delivery body — identical bytes on every retry of a delivery. */
function deliveryBody(delivery: WebhookDelivery): string {
  return JSON.stringify({ id: delivery.id, ...(delivery.payload as object) });
}

/** One signed POST attempt; records the outcome on the delivery row. */
async function attemptDelivery(delivery: WebhookDelivery, webhook: Webhook): Promise<void> {
  const body = deliveryBody(delivery);
  const timestamp = Math.floor(Date.now() / 1000);

  let ok = false;
  let responseStatusCode: number | null = null;
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-QuoteFlow-Event": delivery.eventType,
        "X-QuoteFlow-Delivery": delivery.id,
        [SIGNATURE_HEADER]: buildSignatureHeader(webhook.secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    ok = response.ok;
    responseStatusCode = response.status;
  } catch {
    // Network error / timeout — no status code; treated as a failed attempt.
  }

  const attemptsMade = delivery.attempts + 1;
  if (ok) {
    await updateWebhookDelivery(delivery.id, {
      status: "SUCCESS",
      responseStatusCode,
      nextRetryAt: null,
      incrementAttempt: true,
    });
    return;
  }

  // Failed: schedule the next try per the shared backoff, or go terminal at the
  // cap (nextRetryAt stays null AND attempts >= max — the drain query excludes it).
  const retryable = shouldRetry(attemptsMade, DEFAULT_RETRY_POLICY);
  await updateWebhookDelivery(delivery.id, {
    status: "FAILED",
    responseStatusCode,
    nextRetryAt: retryable
      ? new Date(Date.now() + computeBackoffMs(attemptsMade + 1, DEFAULT_RETRY_POLICY))
      : null,
    incrementAttempt: true,
  });
  if (!retryable) {
    logger.warn("webhook.delivery.exhausted", {
      deliveryId: delivery.id,
      webhookId: webhook.id,
      eventType: delivery.eventType,
    });
  }
}

/**
 * Fan a domain event out to the organization's subscribed webhooks. Called by
 * the event-bus subscriber for every published event; never throws.
 */
export async function dispatchWebhooks<E extends DomainEventName>(
  event: E,
  payload: DomainEventPayload<E>,
): Promise<void> {
  try {
    const hooks = await listActiveWebhooksForEvent(payload.organizationId, event);

    for (const hook of hooks) {
      const delivery = await createWebhookDelivery({
        webhookId: hook.id,
        eventType: event,
        payload: {
          event,
          occurredAt: new Date().toISOString(),
          data: payload as unknown as Prisma.InputJsonObject,
        },
      });
      await attemptDelivery(delivery, hook);
    }

    // Lazy drain (§21.7): piggyback a bounded retry pass on platform activity.
    await processDueWebhookDeliveries(DRAIN_BATCH);
  } catch (error) {
    logger.error("dispatchWebhooks failed", {
      event,
      organizationId: payload.organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Re-attempt every due delivery (PENDING, or FAILED whose backoff has elapsed),
 * bounded by `limit`. Exported for the future cron runner; never throws.
 */
export async function processDueWebhookDeliveries(limit = 100): Promise<void> {
  try {
    const due = await listDueDeliveries(new Date(), limit, DEFAULT_RETRY_POLICY.maxAttempts);
    for (const delivery of due) {
      const webhook = await findWebhookForDispatch(delivery.webhookId);
      if (!webhook || !webhook.isActive) continue;
      await attemptDelivery(delivery, webhook);
    }
  } catch (error) {
    logger.error("processDueWebhookDeliveries failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
