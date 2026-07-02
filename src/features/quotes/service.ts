import "server-only";

import type { DiscountType } from "@prisma/client";

import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { getCompanyConfig } from "@/lib/config/service";
import { getNextQuoteNumber } from "@/lib/numbering";
import { moneyToString, toDecimal } from "@/lib/money";
import { BusinessRuleError } from "@/lib/errors";
import { logActivity } from "@/features/activity/actions";
import { calculateQuoteTotal, type CalcLine } from "@/features/quotes/calculations";
import type { quotePayloadSchema, QuotePayload } from "@/features/quotes/schema";
import type { ActorScope } from "@/types";
import type { z } from "zod";

/**
 * Quote business core (Phase 6B Step 8, §21.6) — the single implementation
 * behind both the staff server action (`actions.ts`) and the Public API's
 * `POST /api/v1/quotes` (§21.12's named equivalence surface). Totals are always
 * recomputed server-side from line items — never trusted from the caller (§39),
 * a rule that matters twice as much now that one caller is a third party.
 *
 * Extracted from the Phase 5 action body with one tightening: a provided
 * `leadId` is verified to belong to the organization before it is stored
 * (§22.3) — the internal UI only ever offered in-org leads, so its behavior is
 * unchanged.
 */

type ResolvedLine = {
  serviceId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRateId: string | null;
  taxRatePercent: string | null;
};

/** Validate item references and resolve each line's effective tax rate (§17). */
export async function resolveLines(
  organizationId: string,
  items: QuotePayload["items"],
): Promise<{ lines: ResolvedLine[]; calcLines: CalcLine[] }> {
  const [taxRates, services] = await Promise.all([
    db.taxRate.findMany({
      where: { organizationId },
      select: { id: true, rate: true, isDefault: true },
    }),
    db.service.findMany({ where: { organizationId }, select: { id: true } }),
  ]);
  const rateById = new Map(taxRates.map((t) => [t.id, t.rate]));
  const defaultRate = taxRates.find((t) => t.isDefault)?.rate ?? null;
  const serviceIds = new Set(services.map((s) => s.id));

  const lines: ResolvedLine[] = items.map((item) => {
    const serviceId = item.serviceId ? String(item.serviceId) : null;
    const taxRateId = item.taxRateId ? String(item.taxRateId) : null;
    if (serviceId && !serviceIds.has(serviceId)) {
      throw new BusinessRuleError("A selected service is no longer available.");
    }
    if (taxRateId && !rateById.has(taxRateId)) {
      throw new BusinessRuleError("A selected tax rate is no longer available.");
    }
    const rate = taxRateId ? rateById.get(taxRateId)! : defaultRate;
    return {
      serviceId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRateId,
      taxRatePercent: rate ? moneyToString(rate) : null,
    };
  });

  const calcLines: CalcLine[] = lines.map((l) => ({
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    taxRatePercent: l.taxRatePercent,
  }));

  return { lines, calcLines };
}

export function parseDiscount(
  data: { discountType?: unknown; discountValue?: unknown },
): { type: DiscountType; value: string } | null {
  const type = data.discountType ? String(data.discountType) : "";
  const value = data.discountValue ? String(data.discountValue) : "";
  if ((type === "PERCENT" || type === "FIXED") && value) {
    return { type, value };
  }
  return null;
}

/**
 * Create a DRAFT quote: reference checks, server-side totals, atomic numbering,
 * row + items in one transaction, Lead-customer backfill, Activity,
 * `quote.created` event. The creator/assignee is the scope's actor.
 */
/** Parsed (OUTPUT) shape of the shared payload schema. */
export type QuoteData = z.output<typeof quotePayloadSchema>;

export async function createQuoteCore(
  scope: ActorScope,
  data: QuoteData,
): Promise<{ id: string }> {
  const { organizationId, actorId } = scope;

  // Customer must belong to the org (tenant isolation).
  const customer = await db.customer.findFirst({
    where: { id: data.customerId, organizationId },
    select: { id: true },
  });
  if (!customer) throw new BusinessRuleError("That customer could not be found.");

  const leadId = data.leadId ? String(data.leadId) : null;
  if (leadId) {
    const lead = await db.lead.findFirst({
      where: { id: leadId, organizationId },
      select: { id: true },
    });
    if (!lead) throw new BusinessRuleError("That lead could not be found.");
  }

  const { lines, calcLines } = await resolveLines(organizationId, data.items);
  const discount = parseDiscount(data);
  const calc = calculateQuoteTotal(calcLines, discount);
  const config = await getCompanyConfig(organizationId);
  const quoteNumber = await getNextQuoteNumber(organizationId);

  const quote = await db.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        organizationId,
        quoteNumber,
        leadId,
        customerId: data.customerId,
        status: "DRAFT",
        version: 1,
        discountType: discount?.type ?? null,
        discountValue: discount ? toDecimal(discount.value) : null,
        subtotal: calc.subtotal,
        taxAmount: calc.taxAmount,
        total: calc.total,
        currency: config.locale.currency,
        issueDate: data.issueDate ? new Date(data.issueDate) : null,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        notes: data.notes ? data.notes : null,
        terms: data.terms ? data.terms : null,
        createdById: actorId,
        assignedToId: actorId,
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
      select: { id: true },
    });

    // Backfill the Lead's customer link on first quote (§14 conversion).
    if (leadId) {
      await tx.lead.updateMany({
        where: { id: leadId, organizationId, customerId: null },
        data: { customerId: data.customerId },
      });
    }
    return created;
  });

  await logActivity({
    organizationId,
    entityType: "QUOTE",
    entityId: quote.id,
    type: "created",
    createdById: actorId,
  });

  emitEvent("quote.created", { organizationId, quoteId: quote.id });

  return { id: quote.id };
}
