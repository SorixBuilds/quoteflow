import { db } from "@/lib/db";
import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { Decimal, moneyToString, sumDecimals, toDecimal } from "@/lib/money";

/**
 * Reports read path (Phase 5, §34). Each report is a single aggregate query (no
 * pre-computed summary tables). Operational reports are OWNER/STAFF; the
 * revenue/AR report is OWNER-only — the one financial report gated above STAFF
 * (§29, §34), enforced inside the query, not just the UI.
 */

export type TurnaroundReport = {
  avgDays: number | null;
  count: number;
};

export async function getQuoteTurnaround(range?: {
  from?: string;
  to?: string;
}): Promise<TurnaroundReport> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const acceptedAt =
    range?.from || range?.to
      ? {
          ...(range.from ? { gte: new Date(range.from) } : {}),
          ...(range.to ? { lte: new Date(`${range.to}T23:59:59`) } : {}),
        }
      : undefined;

  const quotes = await db.quote.findMany({
    where: {
      organizationId,
      status: "ACCEPTED",
      sentAt: { not: null },
      acceptedAt: acceptedAt ? { not: null, ...acceptedAt } : { not: null },
    },
    select: { sentAt: true, acceptedAt: true },
  });

  if (quotes.length === 0) return { avgDays: null, count: 0 };
  const totalMs = quotes.reduce((sum, q) => sum + (q.acceptedAt!.getTime() - q.sentAt!.getTime()), 0);
  const avgDays = Math.round((totalMs / quotes.length / (24 * 60 * 60 * 1000)) * 10) / 10;
  return { avgDays, count: quotes.length };
}

export type LossPatternRow = { reason: string; count: number };

export async function getLossPattern(): Promise<LossPatternRow[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const grouped = await db.lead.groupBy({
    by: ["lostReason"],
    where: { organizationId, status: "LOST" },
    _count: { _all: true },
  });

  return grouped
    .map((g) => ({ reason: g.lostReason?.trim() || "Unspecified", count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

export type LeadSourceRoiRow = {
  id: string;
  name: string;
  totalLeads: number;
  wonLeads: number;
  conversionRatePercent: number | null;
  estimatedCost: string | null;
  acceptedRevenue: string;
};

export async function getLeadSourceRoi(): Promise<LeadSourceRoiRow[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const [sources, acceptedQuotes] = await Promise.all([
    db.leadSource.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        costPerLead: true,
        _count: { select: { leads: true } },
        leads: { where: { status: "WON" }, select: { id: true } },
      },
    }),
    db.quote.findMany({
      where: { organizationId, status: "ACCEPTED", lead: { is: { sourceId: { not: null } } } },
      select: { total: true, lead: { select: { sourceId: true } } },
    }),
  ]);

  // Sum accepted-quote revenue by lead source.
  const revenueBySource = new Map<string, Decimal[]>();
  for (const q of acceptedQuotes) {
    const sourceId = q.lead?.sourceId;
    if (!sourceId) continue;
    const list = revenueBySource.get(sourceId) ?? [];
    list.push(toDecimal(q.total));
    revenueBySource.set(sourceId, list);
  }

  return sources.map((s) => {
    const totalLeads = s._count.leads;
    const wonLeads = s.leads.length;
    const revenue = sumDecimals(revenueBySource.get(s.id) ?? []);
    const estimatedCost = s.costPerLead
      ? moneyToString(toDecimal(s.costPerLead).mul(totalLeads))
      : null;
    return {
      id: s.id,
      name: s.name,
      totalLeads,
      wonLeads,
      conversionRatePercent: totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 1000) / 10 : null,
      estimatedCost,
      acceptedRevenue: moneyToString(revenue),
    };
  });
}

export type RevenueReport = {
  totalInvoiced: string;
  totalCollected: string;
  outstanding: string;
  overdueOutstanding: string;
};

/** Revenue / AR — OWNER only (§29, §34). */
export async function getRevenueReport(): Promise<RevenueReport> {
  await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope();

  const [invoiced, collected, unpaid] = await Promise.all([
    db.invoice.aggregate({ where: { organizationId }, _sum: { amount: true } }),
    db.invoice.aggregate({ where: { organizationId }, _sum: { paidAmount: true } }),
    db.invoice.findMany({
      where: { organizationId, status: { not: "PAID" } },
      select: { amount: true, paidAmount: true, dueDate: true },
    }),
  ]);

  const now = new Date();
  let outstanding = new Decimal(0);
  let overdueOutstanding = new Decimal(0);
  for (const inv of unpaid) {
    const balance = toDecimal(inv.amount).sub(toDecimal(inv.paidAmount));
    if (balance.lessThanOrEqualTo(0)) continue;
    outstanding = outstanding.add(balance);
    if (inv.dueDate && inv.dueDate.getTime() < now.getTime()) {
      overdueOutstanding = overdueOutstanding.add(balance);
    }
  }

  return {
    totalInvoiced: moneyToString(toDecimal(invoiced._sum.amount ?? 0)),
    totalCollected: moneyToString(toDecimal(collected._sum.paidAmount ?? 0)),
    outstanding: moneyToString(outstanding),
    overdueOutstanding: moneyToString(overdueOutstanding),
  };
}
