import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetEventBus,
  emitEvent,
  emitEventAsync,
  eventBus,
  onEvent,
} from "@/lib/events";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  __resetEventBus();
});

describe("event bus singleton helpers (§6)", () => {
  it("emitEvent reaches an onEvent subscriber on the shared singleton", () => {
    const handler = vi.fn();
    onEvent("payment.recorded", handler);
    emitEvent("payment.recorded", {
      organizationId: "o",
      paymentId: "p",
      invoiceId: "i",
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("emitEventAsync awaits the handler", async () => {
    const seen: string[] = [];
    onEvent("job.completed", async (p) => {
      await Promise.resolve();
      seen.push(p.jobId);
    });
    await emitEventAsync("job.completed", { organizationId: "o", jobId: "j-1" });
    expect(seen).toEqual(["j-1"]);
  });

  it("__resetEventBus clears subscriptions between tests", () => {
    onEvent("quote.sent", vi.fn());
    __resetEventBus();
    expect(eventBus.listenerCount("quote.sent")).toBe(0);
  });
});
