import type { Prisma, QuoteStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { moneyToString } from "@/lib/money";
import { parseTableParams } from "@/features/tables/buildPrismaQuery";
import type { TableParams } from "@/features/tables/types";

/**
 * Quote read path (Phase 5, §16, §31, §37). List paginates through the shared
 * params parser with indexed `status`/`customerId`/`assignedToId` filters. Detail
 * loads line items (with their service/tax-rate names), the revision chain, and
 * the linked Job. OWNER/STAFF only, company-scoped.
 */

export type QuoteListRow = {
  id: string;
  quoteNumber: string;
  customerName: string;
  status: QuoteStatus;
  version: number;
  total: string;
  currency: string;
  createdAt: Date;
};

export type QuoteListResult = {
  rows: QuoteListRow[];
  totalCount: number;
  params: TableParams;
};

type ParamSource = Record<string, string | string[] | undefined>;
function readParam(source: ParamSource, key: string): string | undefined {
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}
const QUOTE_STATUS_SET = new Set(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"]);

export async function getQuotes(source: ParamSource): Promise<QuoteListResult> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const parsed = parseTableParams(source, {
    allowedSort: ["quoteNumber", "createdAt", "total"],
    allowedFilters: [],
  });

  const status = readParam(source, "status");
  const customerId = readParam(source, "customerId");
  const search = readParam(source, "quoteNumber")?.trim();

  const where: Prisma.QuoteWhereInput = {
    organizationId,
    ...(status && QUOTE_STATUS_SET.has(status) ? { status: status as QuoteStatus } : {}),
    ...(customerId ? { customerId } : {}),
    ...(search ? { quoteNumber: { contains: search, mode: "insensitive" } } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    db.quote.findMany({
      where,
      orderBy: parsed.orderBy ?? { createdAt: "desc" },
      skip: parsed.skip,
      take: parsed.take,
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        version: true,
        total: true,
        currency: true,
        createdAt: true,
        customer: { select: { name: true } },
      },
    }),
    db.quote.count({ where }),
  ]);

  return {
    rows: rows.map((r) => ({
      id: r.id,
      quoteNumber: r.quoteNumber,
      customerName: r.customer.name,
      status: r.status,
      version: r.version,
      total: moneyToString(r.total),
      currency: r.currency,
      createdAt: r.createdAt,
    })),
    totalCount,
    params: parsed.params,
  };
}

export type QuoteItemDetail = {
  id: string;
  serviceId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  taxRateId: string | null;
  taxRateName: string | null;
  sortOrder: number;
};

export type RevisionChainEntry = {
  id: string;
  quoteNumber: string;
  version: number;
  status: QuoteStatus;
};

export type QuoteDetail = {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  version: number;
  parentQuoteId: string | null;
  customerId: string;
  customerName: string;
  leadId: string | null;
  discountType: "PERCENT" | "FIXED" | null;
  discountValue: string | null;
  subtotal: string;
  taxAmount: string;
  total: string;
  currency: string;
  issueDate: Date | null;
  expiryDate: Date | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  acceptedAt: Date | null;
  declinedAt: Date | null;
  notes: string | null;
  terms: string | null;
  assignedToId: string;
  items: QuoteItemDetail[];
  job: { id: string; status: string } | null;
  revisionChain: RevisionChainEntry[];
};

const ITEM_SELECT = {
  id: true,
  serviceId: true,
  description: true,
  quantity: true,
  unitPrice: true,
  lineTotal: true,
  taxRateId: true,
  sortOrder: true,
  taxRate: { select: { name: true } },
} satisfies Prisma.QuoteItemSelect;

export async function getQuoteById(id: string): Promise<QuoteDetail | null> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const quote = await db.quote.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      version: true,
      parentQuoteId: true,
      customerId: true,
      leadId: true,
      discountType: true,
      discountValue: true,
      subtotal: true,
      taxAmount: true,
      total: true,
      currency: true,
      issueDate: true,
      expiryDate: true,
      sentAt: true,
      viewedAt: true,
      acceptedAt: true,
      declinedAt: true,
      notes: true,
      terms: true,
      assignedToId: true,
      customer: { select: { name: true } },
      items: { orderBy: { sortOrder: "asc" }, select: ITEM_SELECT },
      job: { select: { id: true, status: true } },
    },
  });
  if (!quote) return null;

  const revisionChain = await getRevisionChain(organizationId, quote.id);

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    version: quote.version,
    parentQuoteId: quote.parentQuoteId,
    customerId: quote.customerId,
    customerName: quote.customer.name,
    leadId: quote.leadId,
    discountType: quote.discountType,
    discountValue: quote.discountValue ? moneyToString(quote.discountValue) : null,
    subtotal: moneyToString(quote.subtotal),
    taxAmount: moneyToString(quote.taxAmount),
    total: moneyToString(quote.total),
    currency: quote.currency,
    issueDate: quote.issueDate,
    expiryDate: quote.expiryDate,
    sentAt: quote.sentAt,
    viewedAt: quote.viewedAt,
    acceptedAt: quote.acceptedAt,
    declinedAt: quote.declinedAt,
    notes: quote.notes,
    terms: quote.terms,
    assignedToId: quote.assignedToId,
    items: quote.items.map((it) => ({
      id: it.id,
      serviceId: it.serviceId,
      description: it.description,
      quantity: moneyToString(it.quantity),
      unitPrice: moneyToString(it.unitPrice),
      lineTotal: moneyToString(it.lineTotal),
      taxRateId: it.taxRateId,
      taxRateName: it.taxRate?.name ?? null,
      sortOrder: it.sortOrder,
    })),
    job: quote.job ? { id: quote.job.id, status: quote.job.status } : null,
    revisionChain,
  };
}

/**
 * Walk the revision chain (§16): climb `parentQuoteId` to the root, then BFS
 * through `revisions` to gather every version. Ordered by version. Small chains,
 * so a handful of indexed queries — no recursion-in-SQL needed.
 */
export async function getRevisionChain(
  organizationId: string,
  quoteId: string,
): Promise<RevisionChainEntry[]> {
  // Climb to the root.
  let rootId = quoteId;
  for (let i = 0; i < 50; i++) {
    const node = await db.quote.findFirst({
      where: { id: rootId, organizationId },
      select: { parentQuoteId: true },
    });
    if (!node?.parentQuoteId) break;
    rootId = node.parentQuoteId;
  }

  // BFS down from the root.
  const collected: RevisionChainEntry[] = [];
  const seen = new Set<string>();
  let frontier = [rootId];
  for (let depth = 0; depth < 50 && frontier.length > 0; depth++) {
    const nodes = await db.quote.findMany({
      where: { id: { in: frontier }, organizationId },
      select: { id: true, quoteNumber: true, version: true, status: true },
    });
    for (const n of nodes) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        collected.push(n);
      }
    }
    const children = await db.quote.findMany({
      where: { parentQuoteId: { in: frontier }, organizationId },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((cid) => !seen.has(cid));
  }

  return collected.sort((a, b) => a.version - b.version);
}
