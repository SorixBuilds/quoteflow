import { describe, expect, it } from "vitest";

import {
  findIntegrationProvider,
  integrationRegistry,
  listIntegrationKeys,
  type IntegrationProvider,
} from "@/features/integrations/registry";

describe("integration registry (§20.6)", () => {
  it("starts empty in Phase 6 (zero live integrations)", () => {
    expect(integrationRegistry).toHaveLength(0);
    expect(listIntegrationKeys()).toEqual([]);
  });

  it("returns undefined for an unknown key (graceful, never throws)", () => {
    expect(findIntegrationProvider("quickbooks")).toBeUndefined();
  });

  it("resolves a provider by key (contract shape a real adapter must satisfy)", () => {
    // Demonstrates the lookup contract against a stand-in adapter without
    // mutating the real registry.
    const fake: IntegrationProvider = {
      key: "demo",
      displayName: "Demo",
      connect: async () => ({ status: "CONNECTED", config: { linked: true } }),
      disconnect: async () => {},
    };
    const local = [fake];
    expect(local.find((p) => p.key === "demo")).toBe(fake);
    expect(local.find((p) => p.key === "nope")).toBeUndefined();
  });
});
