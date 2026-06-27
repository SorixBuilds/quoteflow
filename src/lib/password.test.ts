import { describe, expect, it } from "vitest";

import {
  hashPassword,
  runDummyComparison,
  verifyPassword,
} from "@/lib/password";

describe("password hashing (§9.1, §9.7)", () => {
  it("produces a bcrypt hash that is not the plaintext", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toBe("correct horse battery");
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery");
    await expect(verifyPassword("correct horse battery", hash)).resolves.toBe(
      true,
    );
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery");
    await expect(verifyPassword("wrong password here", hash)).resolves.toBe(
      false,
    );
  });

  it("salts: hashing the same password twice yields different hashes", async () => {
    const a = await hashPassword("same-password-123");
    const b = await hashPassword("same-password-123");
    expect(a).not.toBe(b);
  });

  it("runDummyComparison always resolves false (timing guard)", async () => {
    await expect(runDummyComparison("anything")).resolves.toBe(false);
  });
});
