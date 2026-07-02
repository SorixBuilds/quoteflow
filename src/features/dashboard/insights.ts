import "server-only";

import { db } from "@/lib/db";
import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { sumDecimals, toDecimal } from "@/lib/money";
import { linearForecast, type RevenueForecast } from "@/features/dashboard/forecast";

/**
 * Dashboard insight queries (Phase 6B Step 10, §17) — the four new widgets'
 * data, added ALONGSIDE the frozen Phase 5 `getDashboardData` (§17.4: extended,
 * not replaced; none of the existing functions change). Every query is
 * company-scoped, single-statement aggregate/groupBy (§17.6/§23 — no N+1;
 * name lookups are one batched `IN` query, not per-row).
 *
 * Permissions (§17.8): OWNER/STAFF for the operational three; the revenue
 * forecast is OWNER-only — enforced in the query (the same gate the Revenue/AR
 * report uses), not just by the page hiding the widget.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FORECAST_MONTHS = 6;

export type TechnicianPerformanceRow = {
  userId: string;
  name: string;
  completedJobs: number;
  /** Average scheduledDate→completedAt duration in days (1dp), when computable. */
  avgCompletionDays: number | null;
};

/** Jobs completed + average completion time per technician (§17.5). */
export async function getTechnicianPerformance(): Promise<TechnicianPerformanceRow[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const jobs = await db.job.findMany({
    where: { organizationId, status: "COMPLETED", assignedToId: { not: null } },
    select: { assignedToId: true, scheduledDate: true, completedAt: true },
  });
  if (jobs.length === 0) return [];

  type Bucket = { completed: number; durationsMs: number[] };
  const byUser = new Map<string, Bucket>();
  for (const job of jobs) {
    const bucket = byUser.get(job.assignedToId!) ?? { completed: 0, durationsMs: [] };
    bucket.completed += 1;
    if (job.scheduledDate && job.completedAt && job.completedAt >= job.scheduledDate) {
      bucket.durationsMs.push(job.completedAt.getTime() - job.scheduledDate.getTime());
    }
    byUser.set(job.assignedToId!, bucket);
  }

  const users = await db.user.findMany({
    where: { id: { in: [...byUser.keys()] }, organizationId },
    select: { id: true, name: true, email: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name || u.email]));

  return [...byUser.entries()]
    .map(([userId, bucket]) => ({
      userId,
      name: nameById.get(userId) ?? "Former teammate",
      completedJobs: bucket.completed,
      avgCompletionDays:
        bucket.durationsMs.length > 0
          ? Math.round(
              (bucket.durationsMs.reduce((a, b) => a + b, 0) /
                bucket.durationsMs.length /
                MS_PER_DAY) *
                10,
            ) / 10
          : null,
    }))
    .sort((a, b) => b.completedJobs - a.completedJobs);
}

export type SalesPerformanceRow = {
  userId: string;
  name: string;
  quotesSent: number;
  quotesAccepted: number;
  conversionRatePercent: number | null;
};

/** Quotes sent/accepted + conversion rate per assignee (§17.5). */
export async function getSalesPerformance(): Promise<SalesPerformanceRow[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const [sent, accepted] = await Promise.all([
    db.quote.groupBy({
      by: ["assignedToId"],
      where: { organizationId, status: { not: "DRAFT" } },
      _count: { _all: true },
    }),
    db.quote.groupBy({
      by: ["assignedToId"],
      where: { organizationId, status: "ACCEPTED" },
      _count: { _all: true },
    }),
  ]);
  if (sent.length === 0) return [];

  const acceptedById = new Map(accepted.map((g) => [g.assignedToId, g._count._all]));
  const users = await db.user.findMany({
    where: { id: { in: sent.map((g) => g.assignedToId) }, organizationId },
    select: { id: true, name: true, email: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name || u.email]));

  return sent
    .map((g) => {
      const quotesSent = g._count._all;
      const quotesAccepted = acceptedById.get(g.assignedToId) ?? 0;
      return {
        userId: g.assignedToId,
        name: nameById.get(g.assignedToId) ?? "Former teammate",
        quotesSent,
        quotesAccepted,
        conversionRatePercent:
          quotesSent > 0 ? Math.round((quotesAccepted / quotesSent) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => b.quotesAccepted - a.quotesAccepted);
}

export type PipelineAnalytics = {
  stages: { stage: "NEW" | "CONTACTED" | "QUOTED"; count: number; avgAgeDays: number | null }[];
  wonLast90: number;
  lostLast90: number;
};

/**
 * Deeper pipeline breakdown (§17.5): how many leads sit in each open stage and
 * how long they have been in the pipeline, plus the 90-day won/lost outcome.
 * The frozen schema records no per-stage transition timestamp, so "stage
 * duration" is V1-approximated as the average pipeline age (createdAt→now) of
 * the leads currently in the stage — an honest measure over existing columns,
 * consistent with "no speculative schema change" (§7.3).
 */
export async function getPipelineAnalytics(): Promise<PipelineAnalytics> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const ninetyDaysAgo = new Date(Date.now() - 90 * MS_PER_DAY);
  const [open, wonLast90, lostLast90] = await Promise.all([
    db.lead.findMany({
      where: { organizationId, status: { in: ["NEW", "CONTACTED", "QUOTED"] } },
      select: { status: true, createdAt: true },
    }),
    db.lead.count({ where: { organizationId, status: "WON", updatedAt: { gte: ninetyDaysAgo } } }),
    db.lead.count({ where: { organizationId, status: "LOST", updatedAt: { gte: ninetyDaysAgo } } }),
  ]);

  const now = Date.now();
  const stages = (["NEW", "CONTACTED", "QUOTED"] as const).map((stage) => {
    const leads = open.filter((l) => l.status === stage);
    const avgAgeDays =
      leads.length > 0
        ? Math.round(
            (leads.reduce((sum, l) => sum + (now - l.createdAt.getTime()), 0) /
              leads.length /
              MS_PER_DAY) *
              10,
          ) / 10
        : null;
    return { stage, count: leads.length, avgAgeDays };
  });

  return { stages, wonLast90, lostLast90 };
}

/**
 * Linear revenue projection over the last N months of collected payments
 * (§17.5) — OWNER only (§17.8: financial, the same gate as Revenue/AR).
 */
export async function getRevenueForecast(): Promise<RevenueForecast> {
  await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope();

  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (FORECAST_MONTHS - 1), 1));

  const payments = await db.payment.findMany({
    where: { organizationId, paidAt: { gte: windowStart } },
    select: { amount: true, paidAt: true },
  });

  // Bucket by calendar month (UTC), including empty months, oldest first.
  const totals = Array.from({ length: FORECAST_MONTHS }, (_, i) => {
    const month = new Date(
      Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i, 1),
    );
    const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    const inMonth = payments.filter((p) => p.paidAt >= month && p.paidAt < next);
    return { month, total: sumDecimals(inMonth.map((p) => toDecimal(p.amount))) };
  });

  return linearForecast(totals);
}
