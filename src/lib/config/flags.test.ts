import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getClientFeatureFlags,
  isFeatureEnabled,
  requireFeatureFlag,
} from "@/lib/config/flags";
import { getCompanyConfig } from "@/lib/config/service";
import { requireCompanyScope } from "@/lib/permissions";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";

vi.mock("@/lib/config/service", () => ({ getCompanyConfig: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireCompanyScope: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireCompanyScope).mockResolvedValue({ organizationId: "org-1" });
});

describe("feature flag enforcement (Step 17, §20)", () => {
  it("reads flag state through the Configuration Service", async () => {
    vi.mocked(getCompanyConfig).mockResolvedValue(DEFAULT_COMPANY_CONFIG);
    expect(await isFeatureEnabled("invoicing")).toBe(true);
    expect(await isFeatureEnabled("automation")).toBe(false);
  });

  it("requireFeatureFlag rejects a disabled flag (server-action gate)", async () => {
    vi.mocked(getCompanyConfig).mockResolvedValue(DEFAULT_COMPANY_CONFIG);
    await expect(requireFeatureFlag("automation")).rejects.toThrow(
      /not enabled/,
    );
  });

  it("requireFeatureFlag passes for an enabled flag", async () => {
    vi.mocked(getCompanyConfig).mockResolvedValue({
      ...DEFAULT_COMPANY_CONFIG,
      featureFlags: { ...DEFAULT_COMPANY_CONFIG.featureFlags, automation: true },
    });
    await expect(requireFeatureFlag("automation")).resolves.toBeUndefined();
  });
});

describe("client-safe flag exposure (Phase 6A, §6.1)", () => {
  it("returns the full boolean flag map for the tenant", async () => {
    vi.mocked(getCompanyConfig).mockResolvedValue(DEFAULT_COMPANY_CONFIG);
    const flags = await getClientFeatureFlags();
    expect(flags).toEqual(DEFAULT_COMPANY_CONFIG.featureFlags);
    // Booleans only — nothing secret to leak to the client.
    expect(Object.values(flags).every((v) => typeof v === "boolean")).toBe(true);
  });

  it("returns a copy that cannot mutate the cached config", async () => {
    vi.mocked(getCompanyConfig).mockResolvedValue(DEFAULT_COMPANY_CONFIG);
    const flags = await getClientFeatureFlags();
    flags.ai = true;
    expect(DEFAULT_COMPANY_CONFIG.featureFlags.ai).toBe(false);
  });
});
