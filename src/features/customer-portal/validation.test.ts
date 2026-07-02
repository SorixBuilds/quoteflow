import { describe, expect, it } from "vitest";

import { issuePortalTokenSchema } from "@/features/customer-portal/validation";

const customerId = "22222222-2222-4222-8222-222222222222";

describe("issuePortalTokenSchema", () => {
  it("accepts a customer id with an optional label and future expiry", () => {
    const parsed = issuePortalTokenSchema.parse({
      customerId,
      label: "Sent via text",
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    expect(parsed.customerId).toBe(customerId);
  });

  it("accepts a bare customer id (no expiry = non-expiring)", () => {
    expect(issuePortalTokenSchema.parse({ customerId }).expiresAt).toBeUndefined();
  });

  it("rejects a past expiry", () => {
    expect(() =>
      issuePortalTokenSchema.parse({ customerId, expiresAt: new Date(Date.now() - 1000) }),
    ).toThrow();
  });

  it("rejects a non-uuid customer id", () => {
    expect(() => issuePortalTokenSchema.parse({ customerId: "nope" })).toThrow();
  });
});
