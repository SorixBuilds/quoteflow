import "server-only";

import { requireCompanyScope, requireRole } from "@/lib/permissions";
import {
  listDeliveriesForWebhook,
  listWebhooks,
} from "@/features/webhooks/repository";

/**
 * Webhook read path (Phase 6B Step 8, §21.5) — OWNER-only, company-scoped.
 * The signing `secret` never leaves this module (§22.2): list rows are mapped
 * to display-safe fields, and delivery history is reached only through an
 * owned webhook (IDOR guard by construction — deliveries are fetched per
 * owned row, never by a client-supplied delivery id).
 */

export type WebhookDeliveryView = {
  id: string;
  eventType: string;
  status: string;
  responseStatusCode: number | null;
  attempts: number;
  lastAttemptAt: Date | null;
  nextRetryAt: Date | null;
  createdAt: Date;
};

export type WebhookListItem = {
  id: string;
  url: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdAt: Date;
  recentDeliveries: WebhookDeliveryView[];
};

/** Every webhook for the org with its recent delivery history, newest first. */
export async function listWebhooksForOrg(): Promise<WebhookListItem[]> {
  const session = await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope(session);
  const hooks = await listWebhooks(organizationId);

  return Promise.all(
    hooks.map(async (hook) => {
      const deliveries = await listDeliveriesForWebhook(hook.id, 5);
      return {
        id: hook.id,
        url: hook.url,
        subscribedEvents: hook.subscribedEvents,
        isActive: hook.isActive,
        createdAt: hook.createdAt,
        recentDeliveries: deliveries.map((d) => ({
          id: d.id,
          eventType: d.eventType,
          status: d.status,
          responseStatusCode: d.responseStatusCode,
          attempts: d.attempts,
          lastAttemptAt: d.lastAttemptAt,
          nextRetryAt: d.nextRetryAt,
          createdAt: d.createdAt,
        })),
      };
    }),
  );
}
