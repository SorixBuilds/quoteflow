/**
 * Domain event taxonomy (Phase 6, §6, §21.7).
 *
 * The strongly-typed catalog of business events the platform publishes. It
 * generalizes the additive event taxonomy the frozen phases already use
 * informally (the `quote_revised`/`job_completed` Activity types) into one
 * typed map every future consumer subscribes to. Phase 6A ships the bus and the
 * taxonomy; the two first consumers — the Automation engine's `fireTrigger`
 * (Step 8) and the Public API's `dispatchWebhooks` (Step 13) — subscribe to
 * these same events rather than each re-deriving "what happened" (§21.7: "same
 * event taxonomy, two consumers").
 *
 * Adding an event is one entry here — additive, no migration, the same
 * discipline §6 applies to Activity/Notification `type` strings. Every payload
 * carries `organizationId` so a handler can scope its work to the right tenant
 * without a second lookup, and so a future cross-tenant dispatcher can route by
 * it.
 *
 * Event names use the `entity.pastTense` convention (`quote.accepted`) so they
 * read identically to the §15/§21 trigger/webhook names — one vocabulary across
 * automation, webhooks, and this bus.
 */

/** Fields every domain event payload shares. */
export interface BaseEventPayload {
  organizationId: string;
}

/**
 * The closed, typed event map. The key is the wire/event name; the value is its
 * payload shape. Extending it is purely additive.
 */
export interface DomainEventMap {
  "lead.created": BaseEventPayload & { leadId: string };
  "lead.converted": BaseEventPayload & { leadId: string };
  "quote.created": BaseEventPayload & { quoteId: string };
  "quote.sent": BaseEventPayload & { quoteId: string };
  "quote.accepted": BaseEventPayload & { quoteId: string };
  "quote.declined": BaseEventPayload & { quoteId: string };
  "quote.revised": BaseEventPayload & { quoteId: string };
  "job.scheduled": BaseEventPayload & { jobId: string };
  "job.completed": BaseEventPayload & { jobId: string };
  "invoice.created": BaseEventPayload & { invoiceId: string };
  "invoice.sent": BaseEventPayload & { invoiceId: string };
  "invoice.paid": BaseEventPayload & { invoiceId: string };
  "invoice.overdue": BaseEventPayload & { invoiceId: string };
  "payment.recorded": BaseEventPayload & { paymentId: string; invoiceId: string };
  "customer.created": BaseEventPayload & { customerId: string };
  "customer.updated": BaseEventPayload & { customerId: string };
}

/** Every valid event name, derived from the map (single source of truth). */
export type DomainEventName = keyof DomainEventMap;

/** The payload type for a given event name. */
export type DomainEventPayload<E extends DomainEventName> = DomainEventMap[E];

/** Metadata the bus attaches to every dispatch, alongside the typed payload. */
export interface EventMeta {
  /** The event name, so a single handler subscribed to several events can branch. */
  name: DomainEventName;
  /** When the event was published. */
  publishedAt: Date;
}

/** A subscriber. May be sync or async; the bus isolates failures either way. */
export type EventHandler<E extends DomainEventName> = (
  payload: DomainEventPayload<E>,
  meta: EventMeta,
) => void | Promise<void>;
