import "server-only";

import { onEvent } from "@/lib/events";
import { fireTrigger } from "@/features/automation/engine";

/**
 * Automation event subscribers (Phase 6B Step 6, §6, §15.2).
 *
 * The seam that keeps business modules and the automation engine completely
 * separate: business actions only ever *publish* a domain event (they never
 * import the engine, never know a rule exists); the engine *subscribes* here and
 * translates each event into a `fireTrigger(...)` call. The event name is the
 * rule's `triggerType` — one vocabulary across the bus, automation, and the
 * webhook layer (§21.7).
 *
 * Registration is idempotent and runs once at server boot from
 * `instrumentation.ts`. Handlers are async and failure-isolated by the bus, so a
 * rule that misbehaves can neither block nor break the request that published
 * the event.
 */

let registered = false;

export function registerAutomationSubscribers(): void {
  if (registered) return;
  registered = true;

  onEvent("lead.created", (p) => fireTrigger("lead.created", p.leadId, p.organizationId));
  onEvent("lead.converted", (p) => fireTrigger("lead.converted", p.leadId, p.organizationId));
  onEvent("quote.created", (p) => fireTrigger("quote.created", p.quoteId, p.organizationId));
  onEvent("quote.sent", (p) => fireTrigger("quote.sent", p.quoteId, p.organizationId));
  onEvent("quote.accepted", (p) => fireTrigger("quote.accepted", p.quoteId, p.organizationId));
  onEvent("quote.declined", (p) => fireTrigger("quote.declined", p.quoteId, p.organizationId));
  onEvent("job.scheduled", (p) => fireTrigger("job.scheduled", p.jobId, p.organizationId));
  onEvent("job.completed", (p) => fireTrigger("job.completed", p.jobId, p.organizationId));
  onEvent("invoice.created", (p) => fireTrigger("invoice.created", p.invoiceId, p.organizationId));
  // Payment fires against its invoice — that's the entity whose fields (status,
  // balance) a rule wants to condition on.
  onEvent("payment.recorded", (p) => fireTrigger("payment.recorded", p.invoiceId, p.organizationId));
  onEvent("customer.created", (p) => fireTrigger("customer.created", p.customerId, p.organizationId));
  onEvent("customer.updated", (p) => fireTrigger("customer.updated", p.customerId, p.organizationId));
}

/** Test helper — allow a fresh registration after `__resetEventBus()`. */
export function __resetAutomationSubscribers(): void {
  registered = false;
}
