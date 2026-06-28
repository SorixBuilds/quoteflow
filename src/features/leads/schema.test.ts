import { describe, expect, it } from "vitest";

import { leadSchema, leadStatusChangeSchema } from "@/features/leads/schema";

/**
 * Lead validation tests (Phase 5, §14, §28, §40). The conditional
 * lostReason-required-on-LOST rule is the headline case.
 */
describe("leadSchema", () => {
  it("accepts a minimal valid lead", () => {
    const parsed = leadSchema.parse({ name: "Pat", phone: "5551234567" });
    expect(parsed.name).toBe("Pat");
  });
  it("requires a phone", () => {
    expect(() => leadSchema.parse({ name: "Pat", phone: "" })).toThrow();
  });
  it("rejects an invalid email", () => {
    expect(() => leadSchema.parse({ name: "Pat", phone: "1", email: "nope" })).toThrow();
  });
});

describe("leadStatusChangeSchema", () => {
  it("requires lostReason when status is LOST", () => {
    expect(() => leadStatusChangeSchema.parse({ status: "LOST" })).toThrow();
    expect(() => leadStatusChangeSchema.parse({ status: "LOST", lostReason: "Too expensive" })).not.toThrow();
  });
  it("does not require a reason for other statuses", () => {
    expect(() => leadStatusChangeSchema.parse({ status: "WON" })).not.toThrow();
  });
});
