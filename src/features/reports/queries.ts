import { db } from "@/lib/db";
import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { Decimal, moneyToString, sumDecimals, toDecimal } from "@/lib/money";
import { bucketByAge, type AgingBuckets } from "@/features/reports/aging";

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

// ---------------------------------------------------------------------------
// Phase 6B Step 10 (§18) — advanced reports. Same conventions as above: one
// aggregate query each, company-scoped, no summary tables; the financial
// three (aging, profitability, tax) are OWNER-only IN THE QUERY (§18.8/18.9),
// exactly the gate Revenue/AR already uses.
// ---------------------------------------------------------------------------

export type AcceptanceTrendRow = {
  monthLabel: string;
  sent: number;
  accepted: number;
  acceptanceRatePercent: number | null;
};

/** Quote acceptance trend, last 6 calendar months (§18.5). OWNER/STAFF. */
export async function getQuoteAcceptanceTrend(): Promise<AcceptanceTrendRow[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const MONTHS = 6;
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1), 1));

  const [sent, accepted] = await Promise.all([
    db.quote.findMany({
      where: { organizationId, sentAt: { gte: windowStart } },
      select: { sentAt: true },
    }),
    db.quote.findMany({
      where: { organizationId, status: "ACCEPTED", acceptedAt: { gte: windowStart } },
      select: { acceptedAt: true },
    }),
  ]);

  return Array.from({ length: MONTHS }, (_, i) => {
    const month = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i, 1));
    const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    const sentCount = sent.filter((q) => q.sentAt! >= month && q.sentAt! < next).length;
    const acceptedCount = accepted.filter((q) => q.acceptedAt! >= month && q.acceptedAt! < next).length;
    return {
      monthLabel: month.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      sent: sentCount,
      accepted: acceptedCount,
      acceptanceRatePercent:
        sentCount > 0 ? Math.round((acceptedCount / sentCount) * 1000) / 10 : null,
    };
  });
}

export type CustomerLifetimeValueRow = {
  customerId: string;
  name: string;
  invoices: number;
  totalInvoiced: string;
  totalCollected: string;
};

/**
 * Top customers by collected revenue (§18.5) — extends the per-customer
 * lifetime-value computation the Customer detail page already makes, as one
 * org-wide `groupBy`. OWNER/STAFF.
 */
export async function getCustomerLifetimeValue(take = 20): Promise<CustomerLifetimeValueRow[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const grouped = await db.invoice.groupBy({
    by: ["customerId"],
    where: { organizationId },
    _sum: { amount: true, paidAmount: true },
    _count: { _all: true },
    orderBy: { _sum: { paidAmount: "desc" } },
    take,
  });
  if (grouped.length === 0) return [];

  const customers = await db.customer.findMany({
    where: { id: { in: grouped.map((g) => g.customerId) }, organizationId },
    select: { id: true, name: true },
  });
  const nameById = new Map(customers.map((c) => [c.id, c.name]));

  return grouped.map((g) => ({
    customerId: g.customerId,
    name: nameById.get(g.customerId) ?? "Unknown customer",
    invoices: g._count._all,
    totalInvoiced: moneyToString(toDecimal(g._sum.amount ?? 0)),
    totalCollected: moneyToString(toDecimal(g._sum.paidAmount ?? 0)),
  }));
}

/** AR aging buckets (§18.5/18.6). OWNER only (financial). */
export async function getAgingReport(): Promise<AgingBuckets> {
  await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope();

  const unpaid = await db.invoice.findMany({
    where: { organizationId, status: { not: "PAID" } },
    select: { amount: true, paidAmount: true, dueDate: true },
  });
  return bucketByAge(unpaid, new Date());
}

export type ProfitabilityRow = {
  sourceId: string;
  sourceName: string;
  leads: number;
  acquisitionCost: string | null;
  invoicedRevenue: string;
  /** Revenue − acquisition cost, floored at zero display-side only when cost known. */
  net: string | null;
};

/**
 * Lead-acquisition-cost profitability (§18.6's explicit V1 decision): revenue
 * is invoiced `Invoice.amount` attributed through job → quote → lead → source;
 * cost is `LeadSource.costPerLead × leads` — the only real cost figure the
 * frozen schema captures. Explicitly NOT a job-costing P&L (§18.13). OWNER only.
 */
export async function getProfitabilityReport(): Promise<ProfitabilityRow[]> {
  await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope();

  const [sources, invoices] = await Promise.all([
    db.leadSource.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, costPerLead: true, _count: { select: { leads: true } } },
    }),
    db.invoice.findMany({
      where: { organizationId, job: { quote: { lead: { is: { sourceId: { not: null } } } } } },
      select: {
        amount: true,
        job: { select: { quote: { select: { lead: { select: { sourceId: true } } } } } },
      },
    }),
  ]);

  const revenueBySource = new Map<string, Decimal>();
  for (const invoice of invoices) {
    const sourceId = invoice.job.quote.lead?.sourceId;
    if (!sourceId) continue;
    revenueBySource.set(
      sourceId,
      (revenueBySource.get(sourceId) ?? toDecimal(0)).add(toDecimal(invoice.amount)),
    );
  }

  return sources.map((source) => {
    const revenue = revenueBySource.get(source.id) ?? toDecimal(0);
    const cost = source.costPerLead
      ? toDecimal(source.costPerLead).mul(source._count.leads)
      : null;
    return {
      sourceId: source.id,
      sourceName: source.name,
      leads: source._count.leads,
      acquisitionCost: cost ? moneyToString(cost) : null,
      invoicedRevenue: moneyToString(revenue),
      net: cost ? moneyToString(revenue.sub(cost)) : null,
    };
  });
}

export type TaxSummaryRow = {
  taxRateId: string | null;
  taxRateName: string;
  ratePercent: string | null;
  taxableBase: string;
  taxCollectedEstimate: string;
};

/**
 * Tax summary over accepted quotes' line items, grouped by tax rate (§18.5) —
 * an Owner's own filing REFERENCE over already-captured data, explicitly not a
 * compliance tool. OWNER only.
 */
export async function getTaxSummary(range?: { from?: string; to?: string }): Promise<TaxSummaryRow[]> {
  await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope();

  const acceptedAt =
    range?.from || range?.to
      ? {
          ...(range.from ? { gte: new Date(range.from) } : {}),
          ...(range.to ? { lte: new Date(`${range.to}T23:59:59`) } : {}),
        }
      : undefined;

  const items = await db.quoteItem.findMany({
    where: {
      organizationId,
      quote: { is: { status: "ACCEPTED", ...(acceptedAt ? { acceptedAt } : {}) } },
    },
    select: {
      lineTotal: true,
      taxRateId: true,
      taxRate: { select: { name: true, rate: true } },
    },
  });

  type Bucket = { name: string; rate: Decimal | null; base: Decimal; tax: Decimal };
  const buckets = new Map<string, Bucket>();
  for (const item of items) {
    const key = item.taxRateId ?? "none";
    const bucket =
      buckets.get(key) ??
      ({
        name: item.taxRate?.name ?? "No tax rate",
        rate: item.taxRate ? toDecimal(item.taxRate.rate) : null,
        base: toDecimal(0),
        tax: toDecimal(0),
      } satisfies Bucket);
    const line = toDecimal(item.lineTotal);
    bucket.base = bucket.base.add(line);
    if (bucket.rate) bucket.tax = bucket.tax.add(line.mul(bucket.rate).div(100));
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      taxRateId: key === "none" ? null : key,
      taxRateName: bucket.name,
      ratePercent: bucket.rate ? bucket.rate.toFixed(2) : null,
      taxableBase: moneyToString(bucket.base),
      taxCollectedEstimate: moneyToString(bucket.tax),
    }))
    .sort((a, b) => a.taxRateName.localeCompare(b.taxRateName));
}
