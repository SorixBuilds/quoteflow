import { logger } from "@/lib/logger";
import type {
  DomainEventName,
  DomainEventPayload,
  EventHandler,
  EventMeta,
} from "@/lib/events/types";

/**
 * In-process, strongly-typed event bus (Phase 6, §6, §21.7).
 *
 * The internal publish/subscribe spine future automation and webhooks ride on.
 * Foundation only: Phase 6A ships the bus with **no subscribers registered** —
 * publishing an event is a safe no-op until Step 8/Step 13 subscribe. It is
 * deliberately in-process (no broker, no queue) for the same zero-cost reason
 * everything else in this phase defers infrastructure; durable/cross-process
 * delivery is a `JobQueue` concern (`@/lib/jobs`), not the bus's.
 *
 * Two dispatch modes (§6 "synchronous dispatch / asynchronous dispatch"):
 *   - `publish()`  — synchronous fan-out. Invokes every handler in registration
 *     order, right now. Sync throws are caught; a handler that returns a promise
 *     is fired-and-forgotten with its rejection swallowed (logged), so one slow
 *     or failing handler can neither block nor break the publisher. Use when the
 *     publisher must not wait (inside a request-path business action).
 *   - `publishAsync()` — awaits every handler via `allSettled`, isolating
 *     per-handler failures, resolving once all complete. Use from a job runner
 *     or test that needs the side effects to have finished.
 *
 * Handler isolation is the core guarantee: a subscriber throwing never affects
 * the publisher or the other subscribers — automation/webhook failures are
 * observability concerns, never a reason a Quote-accept fails (§15.10).
 */
export class EventBus {
  // One handler set per event name. `unknown` internally; the public generic
  // methods keep the call sites fully typed.
  private readonly handlers = new Map<
    DomainEventName,
    Set<EventHandler<DomainEventName>>
  >();

  /**
   * Subscribe to an event. Returns an unsubscribe disposer. Idempotent per
   * function reference (subscribing the same function twice registers it once).
   */
  subscribe<E extends DomainEventName>(
    name: E,
    handler: EventHandler<E>,
  ): () => void {
    const set =
      this.handlers.get(name) ?? new Set<EventHandler<DomainEventName>>();
    set.add(handler as EventHandler<DomainEventName>);
    this.handlers.set(name, set);
    return () => {
      set.delete(handler as EventHandler<DomainEventName>);
    };
  }

  /** Subscribe for exactly one dispatch, then auto-unsubscribe. */
  once<E extends DomainEventName>(name: E, handler: EventHandler<E>): () => void {
    const dispose = this.subscribe(name, (payload, meta) => {
      dispose();
      return handler(payload as DomainEventPayload<E>, meta);
    });
    return dispose;
  }

  /** How many handlers are subscribed to an event (for tests/observability). */
  listenerCount(name: DomainEventName): number {
    return this.handlers.get(name)?.size ?? 0;
  }

  /**
   * Synchronous fan-out. Never throws to the caller and never blocks on async
   * handlers.
   */
  publish<E extends DomainEventName>(
    name: E,
    payload: DomainEventPayload<E>,
  ): void {
    const meta: EventMeta = { name, publishedAt: new Date() };
    for (const handler of this.snapshot(name)) {
      try {
        const result = handler(payload as never, meta);
        if (result instanceof Promise) {
          result.catch((error) => this.logHandlerError(name, error));
        }
      } catch (error) {
        this.logHandlerError(name, error);
      }
    }
  }

  /**
   * Asynchronous fan-out. Awaits all handlers, isolating failures; resolves once
   * every handler has settled.
   */
  async publishAsync<E extends DomainEventName>(
    name: E,
    payload: DomainEventPayload<E>,
  ): Promise<void> {
    const meta: EventMeta = { name, publishedAt: new Date() };
    const results = await Promise.allSettled(
      this.snapshot(name).map(async (handler) => handler(payload as never, meta)),
    );
    for (const r of results) {
      if (r.status === "rejected") this.logHandlerError(name, r.reason);
    }
  }

  /** Remove every subscriber (test helper; also used to reset between requests in tests). */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Iterate over a *copy* of the handler set so a handler that subscribes or
   * unsubscribes during dispatch (e.g. `once`) cannot mutate the set mid-loop.
   */
  private snapshot(name: DomainEventName): EventHandler<DomainEventName>[] {
    return Array.from(this.handlers.get(name) ?? []);
  }

  private logHandlerError(name: DomainEventName, error: unknown): void {
    logger.error("Event handler failed", {
      event: name,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
