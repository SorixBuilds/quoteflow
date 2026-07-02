import { describe, expect, it } from "vitest";

import { createApiKeySchema } from "@/features/api-keys/validation";

describe("createApiKeySchema", () => {
  it("accepts a named key with a valid scope subset and de-dupes scopes", () => {
    const result = createApiKeySchema.parse({
      name: "Zapier",
      scopes: ["leads:read", "leads:read", "quotes:write"],
    });
    expect(result.scopes).toEqual(["leads:read", "quotes:write"]);
  });

  it("requires at least one scope (no all-by-default)", () => {
    expect(() => createApiKeySchema.parse({ name: "x", scopes: [] })).toThrow();
  });

  it("rejects an unknown scope", () => {
    expect(() =>
      createApiKeySchema.parse({ name: "x", scopes: ["leads:delete"] }),
    ).toThrow();
  });

  it("requires a name", () => {
    expect(() => createApiKeySchema.parse({ name: "", scopes: ["jobs:read"] })).toThrow();
  });
});
