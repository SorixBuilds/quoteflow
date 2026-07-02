import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/permissions", () => ({
  requireRole: vi.fn(),
  requireActiveUser: vi.fn(),
  requireCompanyScope: vi.fn(),
}));
vi.mock("@/features/activity/actions", () => ({ logActivity: vi.fn() }));
vi.mock("@/features/integrations/repository", () => ({
  upsertIntegration: vi.fn(),
  setIntegrationStatus: vi.fn(),
}));

import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { upsertIntegration } from "@/features/integrations/repository";
import { connectIntegration } from "@/features/integrations/actions";

/**
 * §20.10/§20.12: an unknown provider key returns a clean, typed failure —
 * never a throw — and connect is OWNER-gated. (The registry is empty in Phase
 * 6, so "unknown" is every key; the graceful path is the live path.)
 */

const session = {
  id: "u1",
  organizationId: "org-1",
  role: "OWNER" as const,
  name: "Dana",
  email: "dana@acme.test",
};

beforeEach(() => {
  vi.mocked(requireRole).mockResolvedValue(session as never);
  vi.mocked(requireCompanyScope).mockResolvedValue({ organizationId: "org-1" });
});
afterEach(() => vi.clearAllMocks());

describe("connectIntegration (§20.6)", () => {
  it("returns a clean failure for an unknown provider key — no throw, no write", async () => {
    const result = await connectIntegration("quickbooks", null);
    expect(result).toEqual({ success: false, error: "Unknown integration." });
    expect(upsertIntegration).not.toHaveBeenCalled();
  });

  it("is OWNER-gated: a non-OWNER caller gets a failure result (§20.8)", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("forbidden"));
    const result = await connectIntegration("quickbooks", null);
    expect(result.success).toBe(false);
    expect(upsertIntegration).not.toHaveBeenCalled();
  });
});
