import type { JobStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { moneyToString } from "@/lib/money";
import { parseTableParams } from "@/features/tables/buildPrismaQuery";
import type { TableParams } from "@/features/tables/types";

/**
 * Job read path (Phase 5, §20, §23, §29). The one entity with a per-row access
 * tier: a FIELD user only ever sees jobs where `assignedToId = session.userId`.
 * That extra `AND` is applied explicitly here (not hidden in a generic helper),
 * since it is the only such case (§29). OWNER/STAFF see all org jobs.
 */

export type JobListRow = {
  id: string;
  customerName: string;
  quoteNumber: string;
  status: JobStatus;
  scheduledDate: Date | null;
  assigneeName: string | null;
};

export type JobListResult = {
  rows: JobListRow[];
  totalCount: number;
  params: TableParams;
};

type ParamSource = Record<string, string | string[] | undefined>;
function readParam(source: ParamSource, key: string): string | undefined {
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}
const JOB_STATUS_SET = new Set(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

/** Build the company + FIELD-scope filter shared by list/detail/calendar. */
function scopeWhere(
  organizationId: string,
  role: string,
  userId: string,
): Prisma.JobWhereInput {
  return role === "FIELD"
    ? { organizationId, assignedToId: userId }
    : { organizationId };
}

export async function getJobs(source: ParamSource): Promise<JobListResult> {
  const session = await requireRole(["OWNER", "STAFF", "FIELD"]);

  const parsed = parseTableParams(source, {
    allowedSort: ["scheduledDate", "createdAt"],
    allowedFilters: [],
  });

  const status = readParam(source, "status");
  const assignedToId = readParam(source, "assignedToId");

  const where: Prisma.JobWhereInput = {
    ...scopeWhere(session.organizationId, session.role, session.id),
    ...(status && JOB_STATUS_SET.has(status) ? { status: status as JobStatus } : {}),
    // FIELD's assignee filter is forced to themselves by scopeWhere; the explicit
    // filter only applies for OWNER/STAFF.
    ...(session.role !== "FIELD" && assignedToId ? { assignedToId } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    db.job.findMany({
      where,
      orderBy: parsed.orderBy ?? [{ scheduledDate: "asc" }, { createdAt: "desc" }],
      skip: parsed.skip,
      take: parsed.take,
      select: {
        id: true,
        status: true,
        scheduledDate: true,
        customer: { select: { name: true } },
        quote: { select: { quoteNumber: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    db.job.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      customerName: r.customer.name,
      quoteNumber: r.quote.quoteNumber,
      status: r.status,
      scheduledDate: r.scheduledDate,
      assigneeName: r.assignedTo?.name ?? null,
    })),
    totalCount,
    params: parsed.params,
  };
}

export type JobDetail = {
  id: string;
  status: JobStatus;
  scheduledDate: Date | null;
  completedAt: Date | null;
  notes: string | null;
  customerId: string;
  customerName: string;
  quoteId: string;
  quoteNumber: string;
  quoteTotal: string;
  currency: string;
  assignedToId: string | null;
  assigneeName: string | null;
  canManage: boolean;
  invoices: { id: string; invoiceNumber: string; status: string; amount: string }[];
};

export async function getJobById(id: string): Promise<JobDetail | null> {
  const session = await requireRole(["OWNER", "STAFF", "FIELD"]);

  const job = await db.job.findFirst({
    where: { id, ...scopeWhere(session.organizationId, session.role, session.id) },
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      completedAt: true,
      notes: true,
      customerId: true,
      assignedToId: true,
      customer: { select: { name: true } },
      quote: { select: { id: true, quoteNumber: true, total: true, currency: true } },
      assignedTo: { select: { name: true } },
      invoices: {
        orderBy: { createdAt: "desc" },
        select: { id: true, invoiceNumber: true, status: true, amount: true },
      },
    },
  });
  if (!job) return null;

  return {
    id: job.id,
    status: job.status,
    scheduledDate: job.scheduledDate,
    completedAt: job.completedAt,
    notes: job.notes,
    customerId: job.customerId,
    customerName: job.customer.name,
    quoteId: job.quote.id,
    quoteNumber: job.quote.quoteNumber,
    quoteTotal: moneyToString(job.quote.total),
    currency: job.quote.currency,
    assignedToId: job.assignedToId,
    assigneeName: job.assignedTo?.name ?? null,
    canManage: session.role !== "FIELD",
    invoices: job.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      amount: moneyToString(inv.amount),
    })),
  };
}

/** Calendar feed: jobs in a date range, grouped client-side by day (§20). */
export async function getJobsForCalendar(
  from: Date,
  to: Date,
): Promise<{ id: string; customerName: string; status: JobStatus; scheduledDate: Date }[]> {
  const session = await requireRole(["OWNER", "STAFF", "FIELD"]);
  const rows = await db.job.findMany({
    where: {
      ...scopeWhere(session.organizationId, session.role, session.id),
      scheduledDate: { gte: from, lte: to },
    },
    orderBy: { scheduledDate: "asc" },
    select: { id: true, status: true, scheduledDate: true, customer: { select: { name: true } } },
  });
  return rows
    .filter((r): r is typeof r & { scheduledDate: Date } => r.scheduledDate !== null)
    .map((r) => ({
      id: r.id,
      customerName: r.customer.name,
      status: r.status,
      scheduledDate: r.scheduledDate,
    }));
}
