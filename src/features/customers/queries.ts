import type { CustomerType, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { moneyToString, sumDecimals, toDecimal } from "@/lib/money";
import { parseTableParams } from "@/features/tables/buildPrismaQuery";
import type { TableParams } from "@/features/tables/types";

/**
 * Customer read path (Phase 5, §15, §31, §37). List is server-paginated through
 * the shared `parseTableParams` (indexed sort/filter only); detail computes
 * lifetime value on read (no denormalized counter, §15) and gathers the four
 * related sub-lists. All reads are OWNER/STAFF and company-scoped (§39).
 */

export type CustomerListRow = {
  id: string;
  name: string;
  type: CustomerType;
  email: string | null;
  phone: string | null;
  createdAt: Date;
};

export type CustomerListResult = {
  rows: CustomerListRow[];
  totalCount: number;
  params: TableParams;
};

type ParamSource = Record<string, string | string[] | undefined>;

export async function getCustomers(source: ParamSource): Promise<CustomerListResult> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const parsed = parseTableParams(source, {
    allowedSort: ["name", "createdAt"],
    allowedFilters: ["name"],
    defaultPageSize: 25,
  });

  const typeFilter = readParam(source, "type");
  const where: Prisma.CustomerWhereInput = {
    organizationId,
    ...parsed.where,
    ...(typeFilter === "INDIVIDUAL" || typeFilter === "BUSINESS"
      ? { type: typeFilter }
      : {}),
  };

  const [rows, totalCount] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: parsed.orderBy ?? { createdAt: "desc" },
      skip: parsed.skip,
      take: parsed.take,
      select: { id: true, name: true, type: true, email: true, phone: true, createdAt: true },
    }),
    db.customer.count({ where }),
  ]);

  return { rows, totalCount, params: parsed.params };
}

export type CustomerDetail = {
  id: string;
  name: string;
  type: CustomerType;
  email: string | null;
  phone: string | null;
  address: Record<string, unknown> | null;
  createdAt: Date;
  lifetimeValue: string;
  leads: { id: string; name: string; status: string; createdAt: Date }[];
  quotes: { id: string; quoteNumber: string; status: string; total: string }[];
  jobs: { id: string; status: string; scheduledDate: Date | null }[];
  invoices: { id: string; invoiceNumber: string; status: string; amount: string; paidAmount: string }[];
};

export async function getCustomerById(id: string): Promise<CustomerDetail | null> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();

  const customer = await db.customer.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      name: true,
      type: true,
      email: true,
      phone: true,
      address: true,
      createdAt: true,
      leads: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, status: true, createdAt: true },
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, quoteNumber: true, status: true, total: true },
      },
      jobs: {
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, scheduledDate: true },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        select: { id: true, invoiceNumber: true, status: true, amount: true, paidAmount: true },
      },
    },
  });

  if (!customer) return null;

  // Lifetime value = Σ Invoice.amount (computed on read, §15).
  const lifetimeValue = sumDecimals(
    customer.invoices.map((inv) => toDecimal(inv.amount)),
  );

  return {
    id: customer.id,
    name: customer.name,
    type: customer.type,
    email: customer.email,
    phone: customer.phone,
    address: (customer.address as Record<string, unknown> | null) ?? null,
    createdAt: customer.createdAt,
    lifetimeValue: moneyToString(lifetimeValue),
    leads: customer.leads,
    quotes: customer.quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      status: q.status,
      total: moneyToString(q.total),
    })),
    jobs: customer.jobs,
    invoices: customer.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      amount: moneyToString(inv.amount),
      paidAmount: moneyToString(inv.paidAmount),
    })),
  };
}

/** Customer options for pickers (Quote Builder, Lead conversion). */
export async function getCustomerOptions(): Promise<{ id: string; name: string }[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();
  return db.customer.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

function readParam(source: ParamSource, key: string): string | undefined {
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}
