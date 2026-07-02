import { EventBus } from "@/lib/events/bus";
import type {
  DomainEventName,
  DomainEventPayload,
  EventHandler,
} from "@/lib/events/types";

/**
 * Event bus singleton + ergonomic helpers (Phase 6, §6).
 *
 * A single process-wide bus (module-level, the same singleton discipline as
 * `lib/db.ts`) so a subscription registered in one module is visible to a
 * publish in another. Feature modules import these helpers, never construct
 * their own bus — "all future automation should publish events through this
 * system" (authorization brief).
 */
export const eventBus = new EventBus();

/** Subscribe to a domain event; returns an unsubscribe disposer. */
export function onEvent<E extends DomainEventName>(
  name: E,
  handler: EventHandler<E>,
): () => void {
  return eventBus.subscribe(name, handler);
}

/** Publish synchronously (non-blocking, failure-isolated). */
export function emitEvent<E extends DomainEventName>(
  name: E,
  payload: DomainEventPayload<E>,
): void {
  eventBus.publish(name, payload);
}

/** Publish and await all handlers (failure-isolated). */
export function emitEventAsync<E extends DomainEventName>(
  name: E,
  payload: DomainEventPayload<E>,
): Promise<void> {
  return eventBus.publishAsync(name, payload);
}

/** Test helper — clear every subscription on the singleton. */
export function __resetEventBus(): void {
  eventBus.clear();
}

export { EventBus } from "@/lib/events/bus";
export type {
  DomainEventMap,
  DomainEventName,
  DomainEventPayload,
  EventHandler,
  EventMeta,
  BaseEventPayload,
} from "@/lib/events/types";
