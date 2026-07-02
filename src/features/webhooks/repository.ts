import type { Prisma, Webhook, WebhookDelivery } from "@prisma/client";

import { db } from "@/lib/db";
import { generateSecretToken } from "@/lib/secrets";
import type { CreateWebhookInput } from "@/features/webhooks/validation";

/**
 * Webhook + WebhookDelivery repository (§7.2.4, §20/§21) — pure persistence for
 * outbound webhook subscriptions and their per-attempt delivery records.
 * Organization-scoped via an `organizationId` argument on the subscription side;
 * delivery rows are reached through their parent webhook.
 *
 * The webhook `secret` is an HMAC *signing* secret the dispatcher needs back on
 * every delivery, so — unlike the one-way-hashed API key / portal token — it is
 * generated here and stored as issued, returned once at creation (§7.2.4). The
 * actual signing/dispatch worker is a later step; this layer only persists.
 */

/** A newly created webhook plus its one-time signing secret. */
export type CreatedWebhook = {
  record: Webhook;
  /** HMAC signing secret — show to the subscriber once; stored to sign deliveries. */
  secret: string;
};

/** Create a webhook subscription with a freshly generated signing secret. */
export async function createWebhook(
  organizationId: string,
  createdById: string,
  input: CreateWebhookInput,
): Promise<CreatedWebhook> {
  const secret = generateSecretToken(32);
  const record = await db.webhook.create({
    data: {
      organizationId,
      createdById,
      url: input.url,
      secret,
      subscribedEvents: input.subscribedEvents,
    },
  });
  return { record, secret };
}

/** All webhooks for an organization (management screen), newest first. */
export function listWebhooks(organizationId: string): Promise<Webhook[]> {
  return db.webhook.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

/** A single webhook, org-scoped. */
export function getWebhookById(
  organizationId: string,
  id: string,
): Promise<Webhook | null> {
  return db.webhook.findFirst({ where: { id, organizationId } });
}

/**
 * Active webhooks in an organization subscribed to a given event — the dispatch
 * fan-out lookup. `subscribedEvents` uses a Postgres array `has` test.
 */
export function listActiveWebhooksForEvent(
  organizationId: string,
  eventType: string,
): Promise<Webhook[]> {
  return db.webhook.findMany({
    where: { organizationId, isActive: true, subscribedEvents: { has: eventType } },
  });
}

/** Toggle a webhook active/inactive, org-scoped. */
export async function setWebhookActive(
  organizationId: string,
  id: string,
  isActive: boolean,
): Promise<boolean> {
  const result = await db.webhook.updateMany({
    where: { id, organizationId },
    data: { isActive },
  });
  return result.count > 0;
}

/**
 * Delete a webhook and its delivery history, org-scoped and atomic. Delivery
 * rows are removed first because the FK carries no cascade (§7.2.4) — the
 * ownership check gates the whole transaction.
 */
export async function deleteWebhook(
  organizationId: string,
  id: string,
): Promise<boolean> {
  const owned = await db.webhook.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!owned) return false;

  await db.$transaction([
    db.webhookDelivery.deleteMany({ where: { webhookId: id } }),
    db.webhook.deleteMany({ where: { id, organizationId } }),
  ]);
  return true;
}

// --- Delivery records -------------------------------------------------------

/** Input to enqueue a delivery attempt (status defaults to PENDING). */
export type CreateWebhookDeliveryInput = {
  webhookId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
};

/** Enqueue a delivery for the dispatch worker. */
export function createWebhookDelivery(
  input: CreateWebhookDeliveryInput,
): Promise<WebhookDelivery> {
  return db.webhookDelivery.create({
    data: {
      webhookId: input.webhookId,
      eventType: input.eventType,
      payload: input.payload,
    },
  });
}

/** Fields the dispatch worker updates after an attempt. */
export type WebhookDeliveryUpdate = {
  status: "PENDING" | "SUCCESS" | "FAILED";
  responseStatusCode?: number | null;
  nextRetryAt?: Date | null;
  incrementAttempt?: boolean;
};

/** Apply a delivery attempt's outcome. */
export function updateWebhookDelivery(
  id: string,
  update: WebhookDeliveryUpdate,
): Promise<WebhookDelivery> {
  return db.webhookDelivery.update({
    where: { id },
    data: {
      status: update.status,
      responseStatusCode: update.responseStatusCode,
      lastAttemptAt: new Date(),
      nextRetryAt: update.nextRetryAt,
      attempts: update.incrementAttempt ? { increment: 1 } : undefined,
    },
  });
}

/**
 * Deliveries due for (re)try at or before `now` — the drain/worker poll query.
 * Rows at or past `maxAttempts` are terminal (§21.7's capped retry) and are
 * excluded here so dead deliveries never occupy the batch.
 */
export function listDueDeliveries(
  now: Date = new Date(),
  take = 100,
  maxAttempts = 5,
): Promise<WebhookDelivery[]> {
  return db.webhookDelivery.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: maxAttempts },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take,
  });
}

/**
 * The dispatcher's webhook lookup for a due delivery. Deliberately unscoped:
 * the delivery row is reached only through the internal drain (never a request
 * parameter), and its parent webhook row itself carries the tenant.
 */
export function findWebhookForDispatch(id: string): Promise<Webhook | null> {
  return db.webhook.findUnique({ where: { id } });
}

/** Recent deliveries for one webhook (management screen), newest first. */
export function listDeliveriesForWebhook(
  webhookId: string,
  take = 10,
): Promise<WebhookDelivery[]> {
  return db.webhookDelivery.findMany({
    where: { webhookId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
