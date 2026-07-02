import { describe, expect, it } from "vitest";

import { recordAiUsageSchema } from "@/features/ai/validation";

describe("recordAiUsageSchema", () => {
  it("accepts a null-provider zero-cost row (logged from day one)", () => {
    const row = recordAiUsageSchema.parse({
      feature: "quote_draft",
      provider: "null",
      tokensUsed: 0,
      costEstimate: "0",
    });
    expect(row.provider).toBe("null");
  });

  it("accepts a 4dp decimal cost string", () => {
    expect(
      recordAiUsageSchema.parse({ feature: "email_draft", provider: "anthropic", costEstimate: "0.0123" }),
    ).toBeTruthy();
  });

  it("rejects a non-decimal cost (no floats-as-garbage)", () => {
    expect(() =>
      recordAiUsageSchema.parse({ feature: "x", provider: "openai", costEstimate: "abc" }),
    ).toThrow();
  });

  it("rejects a negative token count", () => {
    expect(() =>
      recordAiUsageSchema.parse({ feature: "x", provider: "null", tokensUsed: -1 }),
    ).toThrow();
  });
});
