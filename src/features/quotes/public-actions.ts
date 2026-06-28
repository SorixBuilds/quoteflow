"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { db } from "@/lib/db";
import { verifyQuoteShareToken } from "@/lib/tokens";
import { logActivity } from "@/features/activity/actions";
import { acceptQuote, declineQuote } from "@/features/quotes/actions";
import { toActionError } from "@/lib/errors";
import type { ActionResult } from "@/types";

/**
 * Public quote actions (Phase 5, §16, §35 gap #2, §39). Driven by the HMAC share
 * token, never a session. Each verifies the token to a quote id, then performs a
 * single-purpose, conditional transition on exactly that quote — no escalation,
 * no access to any other record. The system "actor" for Activity/notifications is
 * the quote's owner (a real User row), since the customer has no account.
 */

/** Record the first open of a sent quote (SENT → VIEWED). Idempotent-ish. */
export async function recordQuoteView(token: string): Promise<ActionResult<null>> {
  try {
    const quoteId = verifyQuoteShareToken(token);
    if (!quoteId) return { success: false, error: "Invalid link." };

    const quote = await db.quote.findUnique({
      where: { id: quoteId },
      select: { id: true, organizationId: true, status: true, createdById: true, assignedToId: true },
    });
    if (!quote) return { success: false, error: "Invalid link." };

    // Only the first view transitions SENT → VIEWED; later views are no-ops.
    const result = await db.quote.updateMany({
      where: { id: quoteId, status: "SENT" },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    if (result.count > 0) {
      await logActivity({
        organizationId: quote.organizationId,
        entityType: "QUOTE",
        entityId: quoteId,
        type: "quote_viewed",
        message: "Viewed via public link",
        createdById: quote.createdById,
      });
      await db.notification.create({
        data: {
          organizationId: quote.organizationId,
          userId: quote.assignedToId ?? quote.createdById,
          type: "quote_viewed",
          title: "Quote viewed",
          priority: "NORMAL",
          entityType: "QUOTE",
          entityId: quoteId,
          actionUrl: `/quotes/${quoteId}`,
          actionLabel: "View quote",
        },
      });
    }
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function acceptQuoteByToken(token: string): Promise<ActionResult<null>> {
  const quoteId = verifyQuoteShareToken(token);
  if (!quoteId) return { success: false, error: "Invalid link." };
  const quote = await db.quote.findUnique({ where: { id: quoteId }, select: { createdById: true } });
  if (!quote) return { success: false, error: "Invalid link." };
  const result = await acceptQuote(quoteId, quote.createdById);
  if (result.success) revalidatePath(`/q/${token}`);
  return result.success ? { success: true, data: null } : result;
}

export async function declineQuoteByToken(token: string): Promise<ActionResult<null>> {
  const quoteId = verifyQuoteShareToken(token);
  if (!quoteId) return { success: false, error: "Invalid link." };
  const quote = await db.quote.findUnique({ where: { id: quoteId }, select: { createdById: true } });
  if (!quote) return { success: false, error: "Invalid link." };
  const result = await declineQuote(quoteId, quote.createdById);
  if (result.success) revalidatePath(`/q/${token}`);
  return result.success ? { success: true, data: null } : result;
}
