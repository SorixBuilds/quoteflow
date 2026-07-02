import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), unstable_rethrow: vi.fn() }));

const { db } = vi.hoisted(() => ({
  db: {
    quote: { findFirst: vi.fn() },
    customer: { updateMany: vi.fn() },
    user: { findFirst: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/features/quotes/actions", () => ({ acceptQuote: vi.fn(), declineQuote: vi.fn() }));
vi.mock("@/features/activity/actions", () => ({ logActivity: vi.fn() }));
vi.mock("@/features/customer-portal/repository", () => ({
  listRedeemableTokens: vi.fn(),
  markPortalTokenUsed: vi.fn(),
}));
vi.mock("@/features/customer-portal/token", () => ({ verifyPortalToken: vi.fn() }));
vi.mock("@/features/customer-portal/session", () => ({
  requirePortalSession: vi.fn(),
  setPortalSessionCookie: vi.fn(),
  clearPortalSessionCookie: vi.fn(),
}));

import { redirect } from "next/navigation";
import { acceptQuote, declineQuote } from "@/features/quotes/actions";
import { logActivity } from "@/features/activity/actions";
import { listRedeemableTokens, markPortalTokenUsed } from "@/features/customer-portal/repository";
import { verifyPortalToken } from "@/features/customer-portal/token";
import { requirePortalSession, setPortalSessionCookie } from "@/features/customer-portal/session";
import {
  acceptQuoteFromPortal,
  declineQuoteFromPortal,
  redeemPortalSession,
  updatePortalContactInfo,
} from "@/features/customer-portal/actions";

/**
 * Customer-facing portal actions (§12.6, §12.8). These assert: ownership is
 * proven before any state change; Accept/Decline reuse the shared transitions
 * with the quote's own `createdById` as the system actor (§12.9); the only write
 * is the customer's own contact info; and a token redeems to a cookie + redirect
 * (or a generic failure with no side effect).
 */
const session = { customerId: "cust-1", organizationId: "org-1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePortalSession).mockResolvedValue(session);
});

describe("acceptQuoteFromPortal (§12.8)", () => {
  it("accepts an owned, decidable quote via the shared action, actor = quote.createdById", async () => {
    db.quote.findFirst.mockResolvedValue({ createdById: "owner-1" });
    vi.mocked(acceptQuote).mockResolvedValue({ success: true, data: { status: "ACCEPTED" } });

    const result = await acceptQuoteFromPortal("q1");
    expect(result).toEqual({ success: true, data: null });
    expect(acceptQuote).toHaveBeenCalledWith("q1", "owner-1");

    // The ownership query is scoped to the session customer + org + decidability.
    const where = db.quote.findFirst.mock.calls[0][0].where;
    expect(where.customerId).toBe("cust-1");
    expect(where.organizationId).toBe("org-1");
    expect(where.status.in).toEqual(["SENT", "VIEWED"]);
  });

  it("refuses a quote the customer does not own (no transition)", async () => {
    db.quote.findFirst.mockResolvedValue(null);
    const result = await acceptQuoteFromPortal("not-mine");
    expect(result.success).toBe(false);
    expect(acceptQuote).not.toHaveBeenCalled();
  });
});

describe("declineQuoteFromPortal (§12.8)", () => {
  it("declines an owned quote via the shared action", async () => {
    db.quote.findFirst.mockResolvedValue({ createdById: "owner-1" });
    vi.mocked(declineQuote).mockResolvedValue({ success: true, data: { status: "DECLINED" } });

    const result = await declineQuoteFromPortal("q1");
    expect(result).toEqual({ success: true, data: null });
    expect(declineQuote).toHaveBeenCalledWith("q1", "owner-1");
  });
});

describe("updatePortalContactInfo (§12.3)", () => {
  it("updates only the session customer's contact fields and logs portal_contact_updated", async () => {
    db.customer.updateMany.mockResolvedValue({ count: 1 });
    db.user.findFirst.mockResolvedValue({ id: "owner-1" });

    const result = await updatePortalContactInfo({ email: "new@acme.test", phone: "555" });
    expect(result).toEqual({ success: true, data: null });

    const args = db.customer.updateMany.mock.calls[0][0];
    expect(args.where).toEqual({ id: "cust-1", organizationId: "org-1" });
    expect(args.data.email).toBe("new@acme.test");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "portal_contact_updated",
        entityType: "CUSTOMER",
        entityId: "cust-1",
        createdById: "owner-1",
      }),
    );
  });

  it("rejects an invalid email (no write)", async () => {
    const result = await updatePortalContactInfo({ email: "not-an-email" });
    expect(result.success).toBe(false);
    expect(db.customer.updateMany).not.toHaveBeenCalled();
  });
});

describe("redeemPortalSession (§12.6, §12.10)", () => {
  it("sets the session cookie and redirects on a matching token", async () => {
    vi.mocked(listRedeemableTokens).mockResolvedValue([
      { id: "t1", customerId: "c1", organizationId: "o1", tokenHash: "hash" } as never,
    ]);
    vi.mocked(verifyPortalToken).mockResolvedValue(true);

    await redeemPortalSession("rawtoken");
    expect(markPortalTokenUsed).toHaveBeenCalledWith("t1");
    expect(setPortalSessionCookie).toHaveBeenCalledWith({ customerId: "c1", organizationId: "o1" });
    expect(redirect).toHaveBeenCalledWith("/portal");
  });

  it("returns a generic failure (no cookie) for an unknown token", async () => {
    vi.mocked(listRedeemableTokens).mockResolvedValue([
      { id: "t1", customerId: "c1", organizationId: "o1", tokenHash: "hash" } as never,
    ]);
    vi.mocked(verifyPortalToken).mockResolvedValue(false);

    const result = await redeemPortalSession("badtoken");
    expect(result).toEqual({ success: false, error: expect.any(String) });
    expect(setPortalSessionCookie).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
