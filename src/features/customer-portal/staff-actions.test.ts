import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/permissions", () => ({
  requireRole: vi.fn(),
  requireCompanyScope: vi.fn(),
  requireActiveUser: vi.fn(),
}));

const { db } = vi.hoisted(() => ({ db: { customer: { findFirst: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/features/activity/actions", () => ({ logActivity: vi.fn() }));
vi.mock("@/features/customer-portal/repository", () => ({
  issuePortalToken: vi.fn(),
  revokePortalToken: vi.fn(),
  getPortalTokenById: vi.fn(),
}));

import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { logActivity } from "@/features/activity/actions";
import {
  issuePortalToken as issuePortalTokenRecord,
  revokePortalToken as revokePortalTokenRecord,
  getPortalTokenById,
} from "@/features/customer-portal/repository";
import { issuePortalToken, revokePortalToken } from "@/features/customer-portal/staff-actions";

/**
 * STAFF-facing token actions (§12.6). These run under the staff session — the one
 * place in the portal feature that uses `requireRole`. They assert the one-time
 * link is returned (never re-derivable), issuance/revocation are org-scoped, and
 * both write an audit Activity entry.
 */
const staff = {
  id: "user-1",
  organizationId: "org-1",
  role: "STAFF" as const,
  name: "Dana",
  email: "dana@acme.test",
};
const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(staff);
  vi.mocked(requireCompanyScope).mockResolvedValue({ organizationId: "org-1" });
});

describe("issuePortalToken (§12.6)", () => {
  it("returns the one-time link and logs issuance", async () => {
    db.customer.findFirst.mockResolvedValue({ id: CUSTOMER_ID });
    vi.mocked(issuePortalTokenRecord).mockResolvedValue({
      record: {} as never,
      plaintext: "PLAINTEXT_TOKEN",
    });

    const result = await issuePortalToken({ customerId: CUSTOMER_ID, expiresInDays: 90 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe(
        "http://localhost:3000/portal/login?token=PLAINTEXT_TOKEN",
      );
    }
    expect(requireRole).toHaveBeenCalledWith(["OWNER", "STAFF"]);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "portal_token_issued", entityId: CUSTOMER_ID }),
    );
  });

  it("refuses to issue for a customer outside the staff org", async () => {
    db.customer.findFirst.mockResolvedValue(null);
    const result = await issuePortalToken({ customerId: CUSTOMER_ID });
    expect(result.success).toBe(false);
    expect(issuePortalTokenRecord).not.toHaveBeenCalled();
  });
});

describe("revokePortalToken (§12.9)", () => {
  it("revokes an in-scope token and logs it", async () => {
    vi.mocked(getPortalTokenById).mockResolvedValue({
      id: "t1",
      customerId: CUSTOMER_ID,
    } as never);
    vi.mocked(revokePortalTokenRecord).mockResolvedValue(true);

    const result = await revokePortalToken("t1");
    expect(result).toEqual({ success: true, data: null });
    expect(revokePortalTokenRecord).toHaveBeenCalledWith("org-1", "t1");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "portal_token_revoked", entityId: CUSTOMER_ID }),
    );
  });

  it("returns an error when the token is not in the staff org", async () => {
    vi.mocked(getPortalTokenById).mockResolvedValue(null);
    const result = await revokePortalToken("nope");
    expect(result.success).toBe(false);
    expect(revokePortalTokenRecord).not.toHaveBeenCalled();
  });
});
