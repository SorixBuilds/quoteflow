import type { DomainEventName } from "@/lib/events/types";

/**
 * The webhook-subscribable event catalog (§21.7) — exactly the domain-event
 * taxonomy the bus publishes ("same event taxonomy, two consumers": the
 * Automation engine and this dispatcher). Client-safe: type-only import, no
 * server code, so the Settings UI renders its checkboxes from the same single
 * source the subscriber registers against.
 *
 * The `Record` shape makes coverage a compile-time guarantee: adding an event
 * to `DomainEventMap` without listing it here is a type error, so the catalog
 * can never silently lag the taxonomy.
 */
const EVENT_CATALOG: Record<DomainEventName, true> = {
  "lead.created": true,
  "lead.converted": true,
  "quote.created": true,
  "quote.sent": true,
  "quote.accepted": true,
  "quote.declined": true,
  "quote.revised": true,
  "job.scheduled": true,
  "job.completed": true,
  "invoice.created": true,
  "invoice.sent": true,
  "invoice.paid": true,
  "invoice.overdue": true,
  "payment.recorded": true,
  "customer.created": true,
  "customer.updated": true,
};

/** Every subscribable event name, in display order. */
export const WEBHOOK_EVENTS = Object.keys(EVENT_CATALOG) as DomainEventName[];

/** Type guard: is a stored `subscribedEvents` entry a known event? */
export function isWebhookEvent(value: string): value is DomainEventName {
  return value in EVENT_CATALOG;
}
