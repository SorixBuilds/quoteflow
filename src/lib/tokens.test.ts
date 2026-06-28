import { describe, expect, it } from "vitest";

import { createQuoteShareToken, verifyQuoteShareToken } from "@/lib/tokens";

/**
 * Share-token tests (Phase 5, §35 gap #2, §39). A valid token round-trips to its
 * quote id; any tampering or forgery is rejected — never an enumeration oracle.
 */
describe("quote share tokens", () => {
  it("round-trips a quote id", () => {
    const token = createQuoteShareToken("quote-123");
    expect(verifyQuoteShareToken(token)).toBe("quote-123");
  });

  it("rejects a tampered id", () => {
    const token = createQuoteShareToken("quote-123");
    const tampered = token.replace("quote-123", "quote-999");
    expect(verifyQuoteShareToken(tampered)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = createQuoteShareToken("quote-123");
    const [id] = token.split(".");
    expect(verifyQuoteShareToken(`${id}.deadbeef`)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyQuoteShareToken("no-dot")).toBeNull();
    expect(verifyQuoteShareToken(".sig")).toBeNull();
    expect(verifyQuoteShareToken("")).toBeNull();
  });

  it("produces different signatures for different ids", () => {
    const a = createQuoteShareToken("a");
    const b = createQuoteShareToken("b");
    expect(a).not.toBe(b);
  });
});
