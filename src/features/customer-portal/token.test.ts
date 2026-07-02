import { describe, expect, it } from "vitest";

import { generatePortalToken, verifyPortalToken } from "@/features/customer-portal/token";

describe("portal token", () => {
  it("issues a token whose stored hash is not the plaintext", async () => {
    const { plaintext, tokenHash } = await generatePortalToken();
    expect(plaintext).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(tokenHash).not.toBe(plaintext);
  });

  it("verifies a correct token and rejects a wrong one", async () => {
    const { plaintext, tokenHash } = await generatePortalToken();
    expect(await verifyPortalToken(plaintext, tokenHash)).toBe(true);

    const other = await generatePortalToken();
    expect(await verifyPortalToken(other.plaintext, tokenHash)).toBe(false);
  });
});
