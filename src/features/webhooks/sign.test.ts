import { describe, expect, it } from "vitest";

import {
  buildSignatureHeader,
  signWebhookBody,
  verifySignatureHeader,
} from "@/features/webhooks/sign";

/**
 * §21.12: HMAC signature correctness — a receiver holding the secret verifies
 * a genuine header; any tampering (body, secret, timestamp window, format)
 * fails closed.
 */

const SECRET = "whsec_test_secret";
const BODY = JSON.stringify({ id: "d1", event: "quote.accepted", data: { quoteId: "q1" } });
const NOW = 1_760_000_000; // fixed unix seconds

describe("webhook HMAC signing (§21.9)", () => {
  it("produces a stable, verifiable signature", () => {
    const header = buildSignatureHeader(SECRET, NOW, BODY);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verifySignatureHeader(SECRET, header, BODY, { now: NOW })).toBe(true);
  });

  it("is deterministic for identical inputs (retries send identical signatures)", () => {
    expect(signWebhookBody(SECRET, NOW, BODY)).toBe(signWebhookBody(SECRET, NOW, BODY));
  });

  it("rejects a tampered body", () => {
    const header = buildSignatureHeader(SECRET, NOW, BODY);
    const tampered = BODY.replace("q1", "q2");
    expect(verifySignatureHeader(SECRET, header, tampered, { now: NOW })).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    const header = buildSignatureHeader("other_secret", NOW, BODY);
    expect(verifySignatureHeader(SECRET, header, BODY, { now: NOW })).toBe(false);
  });

  it("rejects a timestamp outside the replay tolerance", () => {
    const header = buildSignatureHeader(SECRET, NOW, BODY);
    expect(
      verifySignatureHeader(SECRET, header, BODY, { now: NOW + 301, toleranceSeconds: 300 }),
    ).toBe(false);
    expect(
      verifySignatureHeader(SECRET, header, BODY, { now: NOW + 299, toleranceSeconds: 300 }),
    ).toBe(true);
  });

  it("rejects malformed headers without throwing", () => {
    for (const bad of ["", "v1=abc", "t=notanumber,v1=deadbeef", "t=1,v1=zz"]) {
      expect(verifySignatureHeader(SECRET, bad, BODY, { now: NOW })).toBe(false);
    }
  });
});
