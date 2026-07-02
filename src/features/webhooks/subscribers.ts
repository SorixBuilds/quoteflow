import "server-only";

import { onEvent } from "@/lib/events";
import { WEBHOOK_EVENTS } from "@/features/webhooks/events";
import { dispatchWebhooks } from "@/features/webhooks/dispatch";

/**
 * Event-bus → webhook dispatcher wiring (§21.7). The second consumer of the
 * same domain-event taxonomy the Automation engine subscribes to: business
 * modules publish exactly once; this module fans each event out to subscribed
 * webhooks. Registered once at boot from `instrumentation.ts`, alongside the
 * automation subscribers. Idempotent — a second call is a no-op.
 */

let registered = false;

export function registerWebhookSubscribers(): void {
  if (registered) return;
  registered = true;

  for (const name of WEBHOOK_EVENTS) {
    onEvent(name, (payload) => dispatchWebhooks(name, payload));
  }
}

/** Test helper — allow re-registration after the bus is reset. */
export function __resetWebhookSubscribers(): void {
  registered = false;
}
