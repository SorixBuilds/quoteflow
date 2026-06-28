import type { LeadStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { moneyToString } from "@/lib/money";
import { parseTableParams } from "@/features/tables/buildPrismaQuery";
import type { TableParams } from "@/features/tables/types";

/**
 * Lead read path (Phase 5, §14, §31, §37). List paginates through the shared
 * params parser; `status`/`sourceId`/`assignedToId` are indexed-column equality
 * filters applied alongside the contains search. OWNER/STAFF only, company-scoped.
 */

export type LeadListRow = {
  id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  sourceName: string | null;
  assigneeName: string | null;
  createdAt: Date;
};

export type LeadListResult = {
  rows: LeadListRow[];
  totalCount: number;
  params: TableParams;
};

type ParamSource = Record<string, string | string[] | undefined>;

function readParam(source: ParamSource, key: string): string | undefined {
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

const STATUS_SET = new Set(["NEW", "CONTACTED", "QUOTED", "WON", "LOST"]);

export async function getLeads(source: ParamSource): Promise<LeadListResult> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const parsed = parseTableParams(source, {
    allowedSort: ["name", "createdAt"],
    allowedFilters: ["name"],
  });

  const status = readParam(source, "status");
  const sourceId = readParam(source, "sourceId");
  const assignedToId = readParam(source, "assignedToId");

  const where: Prisma.LeadWhereInput = {
    organizationId,
    ...parsed.where,
    ...(status && STATUS_SET.has(status) ? { status: status as LeadStatus } : {}),
    ...(sourceId ? { sourceId } : {}),
    ...(assignedToId ? { assignedToId } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: parsed.orderBy ?? { createdAt: "desc" },
      skip: parsed.skip,
      take: parsed.take,
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        createdAt: true,
        source: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    }),
    db.lead.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      status: r.status,
      sourceName: r.source?.name ?? null,
      assigneeName: r.assignedTo?.name ?? null,
      createdAt: r.createdAt,
    })),
    totalCount,
    params: parsed.params,
  };
}

export type LeadDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  status: LeadStatus;
  lostReason: string | null;
  sourceId: string | null;
  sourceName: string | null;
  assignedToId: string | null;
  customerId: string | null;
  customerName: string | null;
  createdAt: Date;
  quotes: { id: string; quoteNumber: string; status: string; total: string }[];
};

export async function getLeadById(id: string): Promise<LeadDetail | null> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const lead = await db.lead.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      lostReason: true,
      sourceId: true,
      assignedToId: true,
      customerId: true,
      createdAt: true,
      source: { select: { name: true } },
      customer: { select: { name: true } },
      quotes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, quoteNumber: true, status: true, total: true },
      },
    },
  });
  if (!lead) return null;

  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    status: lead.status,
    lostReason: lead.lostReason,
    sourceId: lead.sourceId,
    sourceName: lead.source?.name ?? null,
    assignedToId: lead.assignedToId,
    customerId: lead.customerId,
    customerName: lead.customer?.name ?? null,
    createdAt: lead.createdAt,
    quotes: lead.quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      status: q.status,
      total: moneyToString(q.total),
    })),
  };
}

/** Active lead-source options for forms/filters. */
export async function getLeadSourceOptions(): Promise<{ id: string; name: string }[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();
  return db.leadSource.findMany({
    where: { organizationId, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
