import { afterEach, describe, expect, it, vi } from "vitest";

import { EventBus } from "@/lib/events/bus";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const PAYLOAD = { organizationId: "org-1", quoteId: "q-1" } as const;

afterEach(() => {
  vi.clearAllMocks();
});

describe("EventBus (§6 internal event system)", () => {
  it("delivers a synchronous publish to a subscriber with typed payload + meta", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.subscribe("quote.accepted", handler);
    bus.publish("quote.accepted", PAYLOAD);
    expect(handler).toHaveBeenCalledTimes(1);
    const [payload, meta] = handler.mock.calls[0];
    expect(payload).toEqual(PAYLOAD);
    expect(meta.name).toBe("quote.accepted");
    expect(meta.publishedAt).toBeInstanceOf(Date);
  });

  it("is a safe no-op when nobody is subscribed (Phase 6A default state)", () => {
    const bus = new EventBus();
    expect(() => bus.publish("invoice.paid", { organizationId: "o", invoiceId: "i" })).not.toThrow();
  });

  it("fans out to every subscriber in registration order", () => {
    const bus = new EventBus();
    const order: number[] = [];
    bus.subscribe("quote.accepted", () => void order.push(1));
    bus.subscribe("quote.accepted", () => void order.push(2));
    bus.publish("quote.accepted", PAYLOAD);
    expect(order).toEqual([1, 2]);
  });

  it("only invokes handlers for the published event", () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe("quote.accepted", a);
    bus.subscribe("quote.declined", b);
    bus.publish("quote.accepted", PAYLOAD);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  it("isolates a throwing subscriber from the others and the publisher", () => {
    const bus = new EventBus();
    const after = vi.fn();
    bus.subscribe("quote.accepted", () => {
      throw new Error("boom");
    });
    bus.subscribe("quote.accepted", after);
    expect(() => bus.publish("quote.accepted", PAYLOAD)).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("swallows (logs) a rejected async handler in sync publish", async () => {
    const bus = new EventBus();
    bus.subscribe("quote.accepted", async () => {
      throw new Error("async boom");
    });
    expect(() => bus.publish("quote.accepted", PAYLOAD)).not.toThrow();
    // Let the microtask queue drain; no unhandled rejection should escape.
    await Promise.resolve();
  });

  it("unsubscribe disposer removes the handler", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const dispose = bus.subscribe("quote.accepted", handler);
    dispose();
    bus.publish("quote.accepted", PAYLOAD);
    expect(handler).not.toHaveBeenCalled();
    expect(bus.listenerCount("quote.accepted")).toBe(0);
  });

  it("once() delivers exactly one event then auto-unsubscribes", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.once("quote.accepted", handler);
    bus.publish("quote.accepted", PAYLOAD);
    bus.publish("quote.accepted", PAYLOAD);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("publishAsync awaits all handlers and isolates failures", async () => {
    const bus = new EventBus();
    const slow = vi.fn(async () => {
      await Promise.resolve();
    });
    const failing = vi.fn(async () => {
      throw new Error("nope");
    });
    bus.subscribe("quote.accepted", failing);
    bus.subscribe("quote.accepted", slow);
    await expect(bus.publishAsync("quote.accepted", PAYLOAD)).resolves.toBeUndefined();
    expect(slow).toHaveBeenCalledTimes(1);
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it("clear() removes every subscription", () => {
    const bus = new EventBus();
    bus.subscribe("quote.accepted", vi.fn());
    bus.clear();
    expect(bus.listenerCount("quote.accepted")).toBe(0);
  });
});
