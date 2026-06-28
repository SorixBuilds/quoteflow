import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireCompanyScope } from "@/lib/permissions";
import { requireSession } from "@/features/auth/queries";

vi.mock("@/features/auth/queries", () => ({
  getCurrentUser: vi.fn(),
  requireActiveUser: vi.fn(),
  requireRole: vi.fn(),
  requireSession: vi.fn(),
  userHasRole: vi.fn(),
}));

const mockSession = {
  id: "user-1",
  organizationId: "org-1",
  role: "OWNER" as const,
  name: "Dana",
  email: "dana@acme.test",
};

describe("requireCompanyScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the organizationId from an explicitly passed session without re-resolving", async () => {
    const scope = await requireCompanyScope({ organizationId: "org-explicit" });
    expect(scope).toEqual({ organizationId: "org-explicit" });
    expect(requireSession).not.toHaveBeenCalled();
  });

  it("resolves the session when none is passed and returns its organizationId", async () => {
    vi.mocked(requireSession).mockResolvedValue(mockSession);
    const scope = await requireCompanyScope();
    expect(scope).toEqual({ organizationId: "org-1" });
    expect(requireSession).toHaveBeenCalledOnce();
  });

  it("returns only the organizationId key (safe to spread into a Prisma where)", async () => {
    const scope = await requireCompanyScope(mockSession);
    expect(Object.keys(scope)).toEqual(["organizationId"]);
  });
});
