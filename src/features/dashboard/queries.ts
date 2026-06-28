import { db } from "@/lib/db";
import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { moneyToString, toDecimal } from "@/lib/money";
import {
  getRecentActivityForOrganization,
  type OrgActivityEntry,
} from "@/features/activity/queries";

/**
 * Dashboard data (Phase 5, §33). One read function aggregating org-wide KPIs, the
 * lead pipeline, lead-source performance, and the recent-activity feed. Every
 * query is company-scoped and runs as a single aggregate/groupBy — no N+1 (§37).
 * OWNER/STAFF only (FIELD is redirected to /jobs, §11).
 */

export type DashboardKpis = {
  newLeads7d: number;
  conversionRatePercent: number | null;
  avgTurnaroundDays: number | null;
  pipelineRevenue: string;
  jobsThisWeek: number;
};

export type PipelineCard = { id: string; name: string; createdAt: Date };
export type Pipeline = {
  NEW: PipelineCard[];
  CONTACTED: PipelineCard[];
  QUOTED: PipelineCard[];
  counts: Record<"NEW" | "CONTACTED" | "QUOTED", number>;
};

export type LeadSourcePerf = {
  id: string;
  name: string;
  totalLeads: number;
  wonLeads: number;
  conversionRatePercent: number | null;
  costPerLead: string | null;
};

export type DashboardData = {
  currency: string;
  kpis: DashboardKpis;
  pipeline: Pipeline;
  leadSources: LeadSourcePerf[];
  recentActivity: OrgActivityEntry[];
};

const PIPELINE_STATUSES: ("NEW" | "CONTACTED" | "QUOTED")[] = ["NEW", "CONTACTED", "QUOTED"];
const CARDS_PER_COLUMN = 8;

export async function getDashboardData(currency: string): Promise<DashboardData> {
  const session = await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope(session);

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { weekStart, weekEnd } = currentWeekBounds(now);

  const [
    newLeads7d,
    acceptedCount,
    consideredCount,
    pipelineAgg,
    jobsThisWeek,
    acceptedQuotes,
    pipelineLeads,
    leadSources,
    recentActivity,
  ] = await Promise.all([
    db.lead.count({ where: { organizationId, createdAt: { gte: sevenDaysAgo } } }),
    db.quote.count({ where: { organizationId, status: "ACCEPTED" } }),
    db.quote.count({ where: { organizationId, status: { not: "DRAFT" } } }),
    db.quote.aggregate({
      where: { organizationId, status: { in: ["SENT", "VIEWED"] } },
      _sum: { total: true },
    }),
    db.job.count({
      where: { organizationId, scheduledDate: { gte: weekStart, lte: weekEnd } },
    }),
    db.quote.findMany({
      where: { organizationId, status: "ACCEPTED", sentAt: { not: null }, acceptedAt: { not: null } },
      select: { sentAt: true, acceptedAt: true },
    }),
    db.lead.findMany({
      where: { organizationId, status: { in: PIPELINE_STATUSES } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true, status: true },
    }),
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
    getRecentActivityForOrganization(organizationId, 15),
  ]);

  // Avg turnaround in days (computed in JS over the small accepted set).
  let avgTurnaroundDays: number | null = null;
  if (acceptedQuotes.length > 0) {
    const totalMs = acceptedQuotes.reduce((sum, q) => {
      return sum + (q.acceptedAt!.getTime() - q.sentAt!.getTime());
    }, 0);
    avgTurnaroundDays = Math.round((totalMs / acceptedQuotes.length / (24 * 60 * 60 * 1000)) * 10) / 10;
  }

  const pipeline: Pipeline = {
    NEW: [],
    CONTACTED: [],
    QUOTED: [],
    counts: { NEW: 0, CONTACTED: 0, QUOTED: 0 },
  };
  for (const lead of pipelineLeads) {
    const status = lead.status as "NEW" | "CONTACTED" | "QUOTED";
    pipeline.counts[status] += 1;
    if (pipeline[status].length < CARDS_PER_COLUMN) {
      pipeline[status].push({ id: lead.id, name: lead.name, createdAt: lead.createdAt });
    }
  }

  return {
    currency,
    kpis: {
      newLeads7d,
      conversionRatePercent:
        consideredCount > 0 ? Math.round((acceptedCount / consideredCount) * 1000) / 10 : null,
      avgTurnaroundDays,
      pipelineRevenue: moneyToString(toDecimal(pipelineAgg._sum.total ?? 0)),
      jobsThisWeek,
    },
    pipeline,
    leadSources: leadSources.map((s) => {
      const total = s._count.leads;
      const won = s.leads.length;
      return {
        id: s.id,
        name: s.name,
        totalLeads: total,
        wonLeads: won,
        conversionRatePercent: total > 0 ? Math.round((won / total) * 1000) / 10 : null,
        costPerLead: s.costPerLead ? moneyToString(s.costPerLead) : null,
      };
    }),
    recentActivity,
  };
}

function currentWeekBounds(now: Date): { weekStart: Date; weekEnd: Date } {
  const day = now.getDay(); // 0 = Sun
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return { weekStart, weekEnd };
}
