import { beforeEach, describe, expect, it, vi } from "vitest";

import { isFeatureEnabled, requireFeatureFlag } from "@/lib/config/flags";
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
