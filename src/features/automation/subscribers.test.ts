import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { engine } = vi.hoisted(() => ({ engine: { fireTrigger: vi.fn() } }));
vi.mock("@/features/automation/engine", () => engine);
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { emitEvent, __resetEventBus } from "@/lib/events";
import {
  registerAutomationSubscribers,
  __resetAutomationSubscribers,
} from "@/features/automation/subscribers";

/**
 * Event → engine wiring (§6, §15.2). The engine subscribes to domain events and
 * translates each into a `fireTrigger`; business modules only publish. This
 * proves the seam: publishing an event routes to the right trigger, and the
 * event name IS the trigger type.
 */
beforeEach(() => {
  __resetEventBus();
  __resetAutomationSubscribers();
  engine.fireTrigger.mockReset();
  registerAutomationSubscribers();
});
afterEach(() => {
  __resetEventBus();
  __resetAutomationSubscribers();
});

describe("registerAutomationSubscribers", () => {
  it("maps quote.accepted → fireTrigger(quote.accepted, quoteId, org)", () => {
    emitEvent("quote.accepted", { organizationId: "org-1", quoteId: "q1" });
    expect(engine.fireTrigger).toHaveBeenCalledWith("quote.accepted", "q1", "org-1");
  });

  it("fires payment.recorded against the invoice, not the payment", () => {
    emitEvent("payment.recorded", { organizationId: "org-1", paymentId: "p1", invoiceId: "inv1" });
    expect(engine.fireTrigger).toHaveBeenCalledWith("payment.recorded", "inv1", "org-1");
  });

  it("maps customer.created → fireTrigger(customer.created, customerId, org)", () => {
    emitEvent("customer.created", { organizationId: "org-1", customerId: "c1" });
    expect(engine.fireTrigger).toHaveBeenCalledWith("customer.created", "c1", "org-1");
  });

  it("is idempotent — a second registration does not double-fire", () => {
    registerAutomationSubscribers(); // second call, should be a no-op
    emitEvent("lead.created", { organizationId: "org-1", leadId: "l1" });
    expect(engine.fireTrigger).toHaveBeenCalledTimes(1);
  });
});
