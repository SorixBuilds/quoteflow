import { describe, expect, it } from "vitest";

import {
  API_KEY_LIVE_PREFIX,
  API_SCOPES,
  KEY_PREFIX_LENGTH,
  generateApiKey,
  isApiScope,
  prefixOf,
  verifyApiKey,
} from "@/features/api-keys/key";

describe("api-key minting", () => {
  it("exposes the fixed §21.8 scope set (closed list)", () => {
    expect(API_SCOPES).toContain("leads:read");
    expect(API_SCOPES).toContain("webhooks:manage");
    expect(API_SCOPES.length).toBe(11);
    expect(isApiScope("quotes:write")).toBe(true);
    expect(isApiScope("everything")).toBe(false);
  });

  it("pins keyPrefix length to 11 to match the §21.6 narrowing lookup", () => {
    expect(KEY_PREFIX_LENGTH).toBe(11);
  });

  it("mints a namespaced key whose stored parts derive from the plaintext", async () => {
    const { plaintext, keyPrefix, hashedKey } = await generateApiKey();

    expect(plaintext.startsWith(API_KEY_LIVE_PREFIX)).toBe(true);
    expect(keyPrefix).toBe(plaintext.slice(0, KEY_PREFIX_LENGTH));
    expect(prefixOf(plaintext)).toBe(keyPrefix); // auth narrowing recomputes the same prefix
    // The stored hash is never the plaintext.
    expect(hashedKey).not.toBe(plaintext);
  });

  it("verifies a correct key and rejects a wrong/tampered one", async () => {
    const { plaintext, hashedKey } = await generateApiKey();
    expect(await verifyApiKey(plaintext, hashedKey)).toBe(true);
    expect(await verifyApiKey(`${plaintext}x`, hashedKey)).toBe(false);

    const other = await generateApiKey();
    expect(await verifyApiKey(other.plaintext, hashedKey)).toBe(false);
  });

  it("never mints two identical keys", async () => {
    const a = await generateApiKey();
    const b = await generateApiKey();
    expect(a.plaintext).not.toBe(b.plaintext);
  });
});
