"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { QuoteStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requireActiveUser, requireCompanyScope, requireRole } from "@/lib/permissions";
import { emitEvent } from "@/lib/events";
import { getNextQuoteNumber } from "@/lib/numbering";
import { toDecimal } from "@/lib/money";
import { canTransitionQuote, QUOTE_STATUS_LABELS } from "@/lib/status";
import { logActivity } from "@/features/activity/actions";
import { notifyQuoteShared, notifyQuoteDecision } from "@/features/email/dispatch";
import { calculateQuoteTotal } from "@/features/quotes/calculations";
import { quotePayloadSchema, type QuotePayload } from "@/features/quotes/schema";
import { createQuoteCore, parseDiscount, resolveLines } from "@/features/quotes/service";
import { BusinessRuleError, STALE_TRANSITION_MESSAGE, toActionError } from "@/lib/errors";
import type { ActionResult } from "@/types";

/**
 * Quote write path (Phase 5, §16–18, §20, §22, §35). Totals are always recomputed
 * server-side from line items (never trusted from the client, §39). Status
 * transitions are conditional updates (§22). Accepting a quote atomically creates
 * the Job and flips the linked Lead to WON (§20, §35 rule #5).
 */

// `resolveLines`/`parseDiscount` and the create flow moved to `service.ts`
// (Phase 6B Step 8, §21.6) so the Public API shares them; `updateQuote` below
// keeps using the same shared helpers.

export async function createQuote(
  input: QuotePayload,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = quotePayloadSchema.parse(input);

    // Business core shared verbatim with POST /api/v1/quotes (§21.6, §21.12):
    // reference checks, server-side totals, numbering, transaction, Activity,
    // and the `quote.created` event all live in the core.
    const quote = await createQuoteCore({ organizationId, actorId: session.id }, data);

    revalidatePath("/quotes");
    return { success: true, data: { id: quote.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function updateQuote(
  id: string,
  input: QuotePayload,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = quotePayloadSchema.parse(input);

    const existing = await db.quote.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true },
    });
    if (!existing) return { success: false, error: "Quote not found." };
    if (existing.status !== "DRAFT") {
      throw new BusinessRuleError("Only a draft quote can be edited. Create a revision instead.");
    }

    const { lines, calcLines } = await resolveLines(organizationId, data.items);
    const discount = parseDiscount(data);
    const calc = calculateQuoteTotal(calcLines, discount);

    await db.$transaction(async (tx) => {
      // Delete-and-recreate line items (§17) — they have no identity outside the quote.
      await tx.quoteItem.deleteMany({ where: { quoteId: id, organizationId } });
      await tx.quote.update({
        where: { id },
        data: {
          customerId: data.customerId,
          discountType: discount?.type ?? null,
          discountValue: discount ? toDecimal(discount.value) : null,
          subtotal: calc.subtotal,
          taxAmount: calc.taxAmount,
          total: calc.total,
          issueDate: data.issueDate ? new Date(data.issueDate) : null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          notes: data.notes ? data.notes : null,
          terms: data.terms ? data.terms : null,
          items: {
            create: lines.map((line, i) => ({
              organizationId,
              serviceId: line.serviceId,
              description: line.description,
              quantity: toDecimal(line.quantity),
              unitPrice: toDecimal(line.unitPrice),
              lineTotal: calc.lineTotals[i],
              taxRateId: line.taxRateId,
              sortOrder: i,
            })),
          },
        },
      });
    });

    revalidatePath(`/quotes/${id}`);
    return { success: true, data: { id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Create a revision of a non-ACCEPTED quote (§16, §35). Returns the new draft id. */
export async function reviseQuote(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);

    const source = await db.quote.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        version: true,
        customerId: true,
        leadId: true,
        discountType: true,
        discountValue: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        currency: true,
        notes: true,
        terms: true,
        items: {
          orderBy: { sortOrder: "asc" },
          select: {
            serviceId: true,
            description: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,
            taxRateId: true,
            sortOrder: true,
          },
        },
      },
    });
    if (!source) return { success: false, error: "Quote not found." };
    if (source.status === "ACCEPTED") {
      throw new BusinessRuleError("An accepted quote is final and cannot be revised.");
    }

    const quoteNumber = await getNextQuoteNumber(organizationId);
    const revision = await db.quote.create({
      data: {
        organizationId,
        quoteNumber,
        parentQuoteId: source.id,
        version: source.version + 1,
        status: "DRAFT",
        customerId: source.customerId,
        leadId: source.leadId,
        discountType: source.discountType,
        discountValue: source.discountValue,
        subtotal: source.subtotal,
        taxAmount: source.taxAmount,
        total: source.total,
        currency: source.currency,
        notes: source.notes,
        terms: source.terms,
        createdById: session.id,
        assignedToId: session.id,
        items: {
          create: source.items.map((it) => ({
            organizationId,
            serviceId: it.serviceId,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            lineTotal: it.lineTotal,
            taxRateId: it.taxRateId,
            sortOrder: it.sortOrder,
          })),
        },
      },
      select: { id: true },
    });

    await logActivity({
      organizationId,
      entityType: "QUOTE",
      entityId: revision.id,
      type: "quote_revised",
      message: `Revision v${source.version + 1} created`,
      createdById: session.id,
    });

    revalidatePath(`/quotes/${revision.id}`);
    return { success: true, data: { id: revision.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/**
 * Status transition dispatcher for the in-app menu (§22). Routes the requested
 * target to the matching effect; every path is a conditional update.
 */
export async function changeQuoteStatus(
  id: string,
  target: string,
): Promise<ActionResult<{ status: QuoteStatus }>> {
  switch (target) {
    case "SENT":
      return sendQuote(id);
    case "ACCEPTED":
      return acceptQuote(id);
    case "DECLINED":
      return declineQuote(id);
    case "EXPIRED":
      return expireQuote(id);
    default:
      return { success: false, error: "Unsupported status change." };
  }
}

export async function sendQuote(id: string): Promise<ActionResult<{ status: QuoteStatus }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);

    const result = await db.quote.updateMany({
      where: { id, organizationId, status: "DRAFT" },
      data: { status: "SENT", sentAt: new Date(), issueDate: new Date() },
    });
    if (result.count === 0) return { success: false, error: STALE_TRANSITION_MESSAGE };

    await logActivity({
      organizationId,
      entityType: "QUOTE",
      entityId: id,
      type: "quote_sent",
      createdById: session.id,
    });

    // Additive, non-fatal: email the customer the quote + PDF (§5). Never throws.
    await notifyQuoteShared(organizationId, id);
    emitEvent("quote.sent", { organizationId, quoteId: id });

    revalidatePath(`/quotes/${id}`);
    revalidatePath("/quotes");
    return { success: true, data: { status: "SENT" } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/**
 * Accept a quote (§20, §22, §35 rule #5). Conditional update from SENT/VIEWED,
 * then — in the same transaction — create the Job and flip the linked Lead to
 * WON. A concurrent second accept fails cleanly (the conditional WHERE matches no
 * row → count 0).
 */
export async function acceptQuote(
  id: string,
  actorId?: string,
): Promise<ActionResult<{ status: QuoteStatus }>> {
  try {
    let organizationId: string;
    let createdById: string;
    if (actorId) {
      // Public (token) path: the caller already verified the quote id and passes
      // the system actor; org is read from the quote itself below.
      const q = await db.quote.findUnique({ where: { id }, select: { organizationId: true } });
      if (!q) return { success: false, error: "Quote not found." };
      organizationId = q.organizationId;
      createdById = actorId;
    } else {
      const session = await requireRole(["OWNER", "STAFF"]);
      await requireActiveUser();
      ({ organizationId } = await requireCompanyScope(session));
      createdById = session.id;
    }

    const outcome = await db.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id, organizationId },
        select: { id: true, customerId: true, leadId: true, assignedToId: true, createdById: true },
      });
      if (!quote) return { ok: false as const };

      const updated = await tx.quote.updateMany({
        where: { id, organizationId, status: { in: ["SENT", "VIEWED"] } },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (updated.count === 0) return { ok: false as const };

      // §35 rule #5: exactly one Job per accepted quote. `quoteId` is unique, so a
      // duplicate create would throw — but the conditional update above already
      // guarantees we only get here once.
      const job = await tx.job.create({
        data: {
          organizationId,
          quoteId: quote.id,
          customerId: quote.customerId,
          status: "SCHEDULED",
        },
        select: { id: true },
      });

      if (quote.leadId) {
        await tx.lead.updateMany({
          where: { id: quote.leadId, organizationId },
          data: { status: "WON" },
        });
      }
      return { ok: true as const, quote, jobId: job.id };
    });

    if (!outcome.ok) return { success: false, error: STALE_TRANSITION_MESSAGE };

    await logActivity({
      organizationId,
      entityType: "QUOTE",
      entityId: id,
      type: "quote_accepted",
      createdById,
    });
    await logActivity({
      organizationId,
      entityType: "JOB",
      entityId: outcome.jobId,
      type: "created",
      message: "Job created from accepted quote",
      createdById,
    });

    // Notify the quote owner (§25).
    await createNotificationForOrg(organizationId, {
      userId: outcome.quote.assignedToId ?? outcome.quote.createdById,
      type: "quote_accepted",
      title: "Quote accepted",
      priority: "HIGH",
      entityType: "QUOTE",
      entityId: id,
      actionUrl: `/quotes/${id}`,
      actionLabel: "View quote",
    });

    // Customer-facing acceptance confirmation (§5). Non-fatal.
    await notifyQuoteDecision(organizationId, id, "accepted");
    emitEvent("quote.accepted", { organizationId, quoteId: id });

    revalidatePath(`/quotes/${id}`);
    revalidatePath("/quotes");
    revalidatePath("/jobs");
    return { success: true, data: { status: "ACCEPTED" } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function declineQuote(
  id: string,
  actorId?: string,
): Promise<ActionResult<{ status: QuoteStatus }>> {
  try {
    let organizationId: string;
    let createdById: string;
    if (actorId) {
      const q = await db.quote.findUnique({ where: { id }, select: { organizationId: true } });
      if (!q) return { success: false, error: "Quote not found." };
      organizationId = q.organizationId;
      createdById = actorId;
    } else {
      const session = await requireRole(["OWNER", "STAFF"]);
      await requireActiveUser();
      ({ organizationId } = await requireCompanyScope(session));
      createdById = session.id;
    }

    const quote = await db.quote.findFirst({
      where: { id, organizationId },
      select: { assignedToId: true, createdById: true },
    });
    if (!quote) return { success: false, error: "Quote not found." };

    const result = await db.quote.updateMany({
      where: { id, organizationId, status: { in: ["SENT", "VIEWED"] } },
      data: { status: "DECLINED", declinedAt: new Date() },
    });
    if (result.count === 0) return { success: false, error: STALE_TRANSITION_MESSAGE };

    await logActivity({
      organizationId,
      entityType: "QUOTE",
      entityId: id,
      type: "quote_declined",
      createdById,
    });
    await createNotificationForOrg(organizationId, {
      userId: quote.assignedToId ?? quote.createdById,
      type: "quote_declined",
      title: "Quote declined",
      priority: "NORMAL",
      entityType: "QUOTE",
      entityId: id,
      actionUrl: `/quotes/${id}`,
      actionLabel: "View quote",
    });

    // Customer-facing decline confirmation (§5). Non-fatal.
    await notifyQuoteDecision(organizationId, id, "declined");
    emitEvent("quote.declined", { organizationId, quoteId: id });

    revalidatePath(`/quotes/${id}`);
    revalidatePath("/quotes");
    return { success: true, data: { status: "DECLINED" } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function expireQuote(id: string): Promise<ActionResult<{ status: QuoteStatus }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);

    const quote = await db.quote.findFirst({ where: { id, organizationId }, select: { status: true } });
    if (!quote) return { success: false, error: "Quote not found." };
    if (!canTransitionQuote(quote.status, "EXPIRED")) {
      throw new BusinessRuleError(
        `A ${QUOTE_STATUS_LABELS[quote.status]} quote cannot be expired.`,
      );
    }

    const result = await db.quote.updateMany({
      where: { id, organizationId, status: quote.status },
      data: { status: "EXPIRED" },
    });
    if (result.count === 0) return { success: false, error: STALE_TRANSITION_MESSAGE };

    await logActivity({
      organizationId,
      entityType: "QUOTE",
      entityId: id,
      type: "status_changed",
      message: `${QUOTE_STATUS_LABELS[quote.status]} → Expired`,
      createdById: session.id,
    });

    revalidatePath(`/quotes/${id}`);
    return { success: true, data: { status: "EXPIRED" } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/**
 * Notification helper for system/public-triggered events where there is no
 * `createNotification` session in scope. Writes the row directly, org-scoped.
 */
async function createNotificationForOrg(
  organizationId: string,
  input: {
    userId: string;
    type: string;
    title: string;
    priority: "LOW" | "NORMAL" | "HIGH";
    entityType: "QUOTE";
    entityId: string;
    actionUrl: string;
    actionLabel: string;
  },
): Promise<void> {
  await db.notification.create({
    data: {
      organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      priority: input.priority,
      entityType: input.entityType,
      entityId: input.entityId,
      actionUrl: input.actionUrl,
      actionLabel: input.actionLabel,
    },
  });
}
