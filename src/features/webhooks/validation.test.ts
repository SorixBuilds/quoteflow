import { describe, expect, it } from "vitest";

import { createWebhookSchema } from "@/features/webhooks/validation";

describe("createWebhookSchema", () => {
  it("accepts an https URL with a de-duplicated event set", () => {
    const result = createWebhookSchema.parse({
      url: "https://hooks.example.com/in",
      subscribedEvents: ["quote.accepted", "quote.accepted", "invoice.paid"],
    });
    expect(result.subscribedEvents).toEqual(["quote.accepted", "invoice.paid"]);
  });

  it("rejects a plaintext http URL", () => {
    expect(() =>
      createWebhookSchema.parse({
        url: "http://hooks.example.com/in",
        subscribedEvents: ["quote.accepted"],
      }),
    ).toThrow();
  });

  it("requires at least one subscribed event", () => {
    expect(() =>
      createWebhookSchema.parse({ url: "https://x.test/h", subscribedEvents: [] }),
    ).toThrow();
  });
});
