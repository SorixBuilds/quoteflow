import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveCompanyConfigAction } from "@/features/settings/actions";
import { updateCompanyConfig } from "@/lib/config/service";
import { requireRole } from "@/lib/permissions";
import { revalidatePath, revalidateTag } from "next/cache";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";
import {
  NOTIFICATIONS_STALE_MS,
} from "@/features/notifications/useNotifications";

vi.mock("@/lib/config/service", () => ({ updateCompanyConfig: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ requireRole: vi.fn() }));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

const owner = {
  id: "u1",
  organizationId: "org-1",
  role: "OWNER" as const,
  name: "Dana",
  email: "d@a.test",
};

beforeEach(() => vi.clearAllMocks());

describe("config cache invalidation (Step 16, §21)", () => {
  it("invalidates the tenant config tag and routes after a successful save", async () => {
    vi.mocked(requireRole).mockResolvedValue(owner);
    vi.mocked(updateCompanyConfig).mockResolvedValue(DEFAULT_COMPANY_CONFIG);

    await saveCompanyConfigAction({ pdf: { showLogo: false } });

    expect(revalidateTag).toHaveBeenCalledWith("company-config-org-1", {
      expire: 0,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/settings", "layout");
  });

  it("does not invalidate when the save fails", async () => {
    vi.mocked(requireRole).mockResolvedValue(owner);
    vi.mocked(updateCompanyConfig).mockRejectedValue(new Error("nope"));

    const result = await saveCompanyConfigAction({ pdf: { showLogo: false } });

    expect(result.success).toBe(false);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("notifications staleness policy (Step 16, §21)", () => {
  it("uses a 30s stale time", () => {
    expect(NOTIFICATIONS_STALE_MS).toBe(30_000);
  });
});
