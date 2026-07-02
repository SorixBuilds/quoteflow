import { describe, expect, it } from "vitest";

import { generateSecretToken, hashToken, verifyToken } from "@/lib/secrets";

describe("secrets", () => {
  it("generates a URL-safe high-entropy token", () => {
    const token = generateSecretToken();
    // base64url alphabet only — safe to embed in a URL/header without encoding.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    // 32 bytes → 43 base64url chars (no padding).
    expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it("honors a custom byte length", () => {
    expect(generateSecretToken(8).length).toBeLessThan(generateSecretToken(32).length);
  });

  it("never repeats a token", () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateSecretToken()));
    expect(seen.size).toBe(50);
  });

  it("hashes and verifies a token round-trip", async () => {
    const token = generateSecretToken();
    const hash = await hashToken(token);
    expect(hash).not.toBe(token); // never stored as plaintext
    expect(await verifyToken(token, hash)).toBe(true);
  });

  it("rejects a wrong token", async () => {
    const hash = await hashToken(generateSecretToken());
    expect(await verifyToken(generateSecretToken(), hash)).toBe(false);
  });
});
