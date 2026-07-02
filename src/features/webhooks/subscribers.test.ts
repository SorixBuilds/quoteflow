import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dispatch } = vi.hoisted(() => ({
  dispatch: { dispatchWebhooks: vi.fn() },
}));

vi.mock("@/features/webhooks/dispatch", () => dispatch);

import { __resetEventBus, emitEventAsync } from "@/lib/events";
import {
  __resetWebhookSubscribers,
  registerWebhookSubscribers,
} from "@/features/webhooks/subscribers";
import { WEBHOOK_EVENTS } from "@/features/webhooks/events";

/**
 * §21.7 wiring: every domain event on the bus reaches `dispatchWebhooks` with
 * its name and payload — the taxonomy's second consumer, registered once.
 */

beforeEach(() => {
  __resetEventBus();
  __resetWebhookSubscribers();
  registerWebhookSubscribers();
});

afterEach(() => {
  vi.clearAllMocks();
  __resetEventBus();
  __resetWebhookSubscribers();
});

describe("registerWebhookSubscribers", () => {
  it("routes a published event to dispatchWebhooks with name + payload", async () => {
    await emitEventAsync("quote.accepted", { organizationId: "org-1", quoteId: "q1" });

    expect(dispatch.dispatchWebhooks).toHaveBeenCalledExactlyOnceWith("quote.accepted", {
      organizationId: "org-1",
      quoteId: "q1",
    });
  });

  it("covers the entire taxonomy — a sample from each entity family dispatches", async () => {
    await emitEventAsync("lead.created", { organizationId: "org-1", leadId: "l1" });
    await emitEventAsync("job.completed", { organizationId: "org-1", jobId: "j1" });
    await emitEventAsync("payment.recorded", {
      organizationId: "org-1",
      paymentId: "p1",
      invoiceId: "i1",
    });
    await emitEventAsync("customer.updated", { organizationId: "org-1", customerId: "c1" });

    expect(dispatch.dispatchWebhooks).toHaveBeenCalledTimes(4);
    // And the catalog itself covers all 16 taxonomy events (compile-checked too).
    expect(WEBHOOK_EVENTS).toHaveLength(16);
  });

  it("is idempotent — a second registration does not double-dispatch", async () => {
    registerWebhookSubscribers();
    await emitEventAsync("quote.accepted", { organizationId: "org-1", quoteId: "q1" });
    expect(dispatch.dispatchWebhooks).toHaveBeenCalledTimes(1);
  });
});
