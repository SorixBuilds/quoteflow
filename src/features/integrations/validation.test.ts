import { describe, expect, it } from "vitest";

import { connectIntegrationSchema } from "@/features/integrations/validation";

describe("connectIntegrationSchema", () => {
  it("accepts a provider with optional non-secret config metadata", () => {
    const parsed = connectIntegrationSchema.parse({
      provider: "quickbooks",
      config: { companyFile: "Acme Co" },
    });
    expect(parsed.provider).toBe("quickbooks");
    expect(parsed.config).toMatchObject({ companyFile: "Acme Co" });
  });

  it("accepts a provider with no config", () => {
    expect(connectIntegrationSchema.parse({ provider: "stripe" }).config).toBeUndefined();
  });

  it("requires a provider name", () => {
    expect(() => connectIntegrationSchema.parse({ provider: "" })).toThrow();
  });
});
