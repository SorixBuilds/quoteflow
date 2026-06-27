import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCompanyConfig, updateCompanyConfig } from "@/lib/config/service";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { logActivity } from "@/features/activity/actions";
import { readRawSettings } from "@/lib/config/cache";

vi.mock("@/lib/db", () => ({
  db: { organization: { update: vi.fn() } },
}));
vi.mock("@/lib/permissions", () => ({ requireRole: vi.fn() }));
vi.mock("@/features/activity/actions", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/config/cache", () => ({
  readRawSettings: vi.fn(),
  companyConfigTag: (id: string) => `company-config-${id}`,
}));

const owner = {
  id: "user-1",
  organizationId: "org-1",
  role: "OWNER" as const,
  name: "Dana",
  email: "dana@acme.test",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCompanyConfig", () => {
  it("returns defaults for an empty stored blob", async () => {
    vi.mocked(readRawSettings).mockResolvedValue({});
    const config = await getCompanyConfig("org-1");
    expect(config).toEqual(DEFAULT_COMPANY_CONFIG);
  });

  it("merges stored values over defaults", async () => {
    vi.mocked(readRawSettings).mockResolvedValue({
      locale: { currency: "EUR" },
    });
    const config = await getCompanyConfig("org-1");
    expect(config.locale.currency).toBe("EUR");
    expect(config.locale.dateFormat).toBe(
      DEFAULT_COMPANY_CONFIG.locale.dateFormat,
    );
  });
});

describe("updateCompanyConfig", () => {
  it("OWNER write → read round-trip persists the merged document", async () => {
    vi.mocked(requireRole).mockResolvedValue(owner);
    vi.mocked(readRawSettings).mockResolvedValue({});

    const result = await updateCompanyConfig("org-1", {
      branding: { primaryColor: "#123456" },
    });

    expect(result.branding.primaryColor).toBe("#123456");
    // The persisted value is the full validated document, not a raw patch.
    expect(db.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { settings: result },
    });
  });

  it("section-aware merge preserves untouched sections", async () => {
    vi.mocked(requireRole).mockResolvedValue(owner);
    vi.mocked(readRawSettings).mockResolvedValue({
      locale: { currency: "GBP", dateFormat: "DD/MM/YYYY" },
    });

    const result = await updateCompanyConfig("org-1", {
      branding: { accentColor: "#ABCDEF" },
    });

    expect(result.branding.accentColor).toBe("#ABCDEF");
    // locale (a different section) is untouched.
    expect(result.locale).toEqual({ currency: "GBP", dateFormat: "DD/MM/YYYY" });
    // numbering (default) is untouched.
    expect(result.numbering).toEqual(DEFAULT_COMPANY_CONFIG.numbering);
  });

  it("logs a settings_updated activity", async () => {
    vi.mocked(requireRole).mockResolvedValue(owner);
    vi.mocked(readRawSettings).mockResolvedValue({});

    await updateCompanyConfig("org-1", { pdf: { showLogo: false } });

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org-1",
        entityType: "ORGANIZATION",
        entityId: "org-1",
        type: "settings_updated",
        createdById: "user-1",
      }),
    );
  });

  it("rejects a non-OWNER caller (requireRole throws)", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("insufficient-role"));
    await expect(
      updateCompanyConfig("org-1", { pdf: { showLogo: false } }),
    ).rejects.toThrow();
    expect(db.organization.update).not.toHaveBeenCalled();
  });

  it("rejects a cross-organization write", async () => {
    vi.mocked(requireRole).mockResolvedValue({ ...owner, organizationId: "org-2" });
    await expect(
      updateCompanyConfig("org-1", { pdf: { showLogo: false } }),
    ).rejects.toThrow(/another organization/);
    expect(db.organization.update).not.toHaveBeenCalled();
  });

  it("aborts before writing when the merged document is invalid", async () => {
    vi.mocked(requireRole).mockResolvedValue(owner);
    vi.mocked(readRawSettings).mockResolvedValue({});
    await expect(
      updateCompanyConfig("org-1", {
        branding: { primaryColor: "not-a-color" },
      }),
    ).rejects.toThrow();
    expect(db.organization.update).not.toHaveBeenCalled();
  });
});
