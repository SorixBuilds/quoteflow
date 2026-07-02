"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";

import { db } from "@/lib/db";
import { toActionError } from "@/lib/errors";
import { logActivity } from "@/features/activity/actions";
import { acceptQuote, declineQuote } from "@/features/quotes/actions";
import {
  listRedeemableTokens,
  markPortalTokenUsed,
} from "@/features/customer-portal/repository";
import { verifyPortalToken } from "@/features/customer-portal/token";
import {
  clearPortalSessionCookie,
  requirePortalSession,
  setPortalSessionCookie,
} from "@/features/customer-portal/session";
import { portalContactSchema, type PortalContactInput } from "@/features/customer-portal/validation";
import type { ActionResult } from "@/types";

/**
 * Customer-facing portal actions (§12.6, §12.8). This module is the portal's
 * **session plane** and, by deliberate design, imports NO staff auth helper —
 * not `requireSession`, not `requireRole`, not `@/lib/auth`. The only identity it
 * trusts is `requirePortalSession()`, which yields `{ customerId, organizationId }`
 * and nothing else. The staff-facing issue/revoke actions live in
 * `staff-actions.ts`; keeping the two surfaces in separate files makes the
 * import-boundary guarantee (§12.12, §25) mechanically testable.
 *
 * Accept/Decline reuse the **same** `acceptQuote()`/`declineQuote()` actions the
 * staff app and the public share-link use (§12.8) — re-pointed to a portal
 * identity by passing the quote's own `createdById` as the system actor, exactly
 * as the public-link flow does (`Activity.createdById` is a real `User` FK; a
 * `Customer` is never a valid value for it, §12.9). The conditional-update
 * concurrency guarantee inside those actions is unchanged.
 */

/** Shown for any invalid/expired/revoked token — never says which (§12.10). */
const INVALID_LINK = "This link is no longer valid — please contact the business for a new one.";

/** Find the redeemable token whose hash matches the presented plaintext, or null. */
async function matchRedeemableToken(rawToken: string) {
  const candidates = await listRedeemableTokens();
  for (const candidate of candidates) {
    if (await verifyPortalToken(rawToken, candidate.tokenHash)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Redeem a portal link: verify the presented token, set the portal session
 * cookie, and land the customer on their dashboard. A bad token returns a
 * generic error (no enumeration oracle); a good one redirects.
 */
export async function redeemPortalSession(rawToken: string): Promise<ActionResult<null>> {
  try {
    const token = rawToken.trim();
    if (!token) return { success: false, error: INVALID_LINK };

    const match = await matchRedeemableToken(token);
    if (!match) return { success: false, error: INVALID_LINK };

    await markPortalTokenUsed(match.id);
    await setPortalSessionCookie({
      customerId: match.customerId,
      organizationId: match.organizationId,
    });
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
  // Outside the try so the redirect control-flow error is never swallowed.
  redirect("/portal");
}

/** Clear the portal session and return to the login screen. */
export async function logoutPortal(): Promise<void> {
  await clearPortalSessionCookie();
  redirect("/portal/login");
}

export async function acceptQuoteFromPortal(quoteId: string): Promise<ActionResult<null>> {
  try {
    const session = await requirePortalSession();

    // Prove ownership + decidability under the portal scope BEFORE acting —
    // `acceptQuote` trusts the actor/org but does not check `customerId`.
    const quote = await db.quote.findFirst({
      where: {
        id: quoteId,
        organizationId: session.organizationId,
        customerId: session.customerId,
        status: { in: ["SENT", "VIEWED"] },
      },
      select: { createdById: true },
    });
    if (!quote) return { success: false, error: "This quote can no longer be accepted." };

    const result = await acceptQuote(quoteId, quote.createdById);
    if (!result.success) return result;

    revalidatePath("/portal");
    revalidatePath("/portal/quotes");
    revalidatePath(`/portal/quotes/${quoteId}`);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function declineQuoteFromPortal(quoteId: string): Promise<ActionResult<null>> {
  try {
    const session = await requirePortalSession();

    const quote = await db.quote.findFirst({
      where: {
        id: quoteId,
        organizationId: session.organizationId,
        customerId: session.customerId,
        status: { in: ["SENT", "VIEWED"] },
      },
      select: { createdById: true },
    });
    if (!quote) return { success: false, error: "This quote can no longer be declined." };

    const result = await declineQuote(quoteId, quote.createdById);
    if (!result.success) return result;

    revalidatePath("/portal");
    revalidatePath("/portal/quotes");
    revalidatePath(`/portal/quotes/${quoteId}`);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/**
 * Update the customer's own contact details (§12.3) — the portal's only write to
 * a business entity. Validated by the SAME schema the internal Customer module
 * uses for these fields (`portalContactSchema` picks them from `customerSchema`),
 * scoped to the session's customer, and attributed for Activity to the org's
 * earliest OWNER (a `Customer` can't be an `Activity.createdById`, §12.9).
 */
export async function updatePortalContactInfo(
  input: PortalContactInput,
): Promise<ActionResult<null>> {
  try {
    const session = await requirePortalSession();
    const parsed = portalContactSchema.parse(input);

    const email = parsed.email && parsed.email.length > 0 ? parsed.email : null;
    const phone = parsed.phone && parsed.phone.length > 0 ? parsed.phone : null;
    const address = parsed.address ?? undefined;

    const updated = await db.customer.updateMany({
      where: { id: session.customerId, organizationId: session.organizationId },
      data: { email, phone, ...(address ? { address } : {}) },
    });
    if (updated.count === 0) {
      return { success: false, error: "We couldn't update your details. Please try again." };
    }

    const actorId = await earliestOwnerId(session.organizationId);
    if (actorId) {
      await logActivity({
        organizationId: session.organizationId,
        entityType: "CUSTOMER",
        entityId: session.customerId,
        type: "portal_contact_updated",
        message: "Updated via customer portal",
        createdById: actorId,
      });
    }

    revalidatePath("/portal/account");
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** The org's earliest-created OWNER — the deterministic Activity actor for portal-only events (§12.9). */
async function earliestOwnerId(organizationId: string): Promise<string | null> {
  const owner = await db.user.findFirst({
    where: { organizationId, role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return owner?.id ?? null;
}
