import type { InvoiceStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { moneyToString } from "@/lib/money";
import { parseTableParams } from "@/features/tables/buildPrismaQuery";
import { invoiceBalanceFromStrings, isInvoiceOverdue } from "@/features/invoices/calculations";
import { fireOverdueOnRead } from "@/features/automation/engine";
import type { TableParams } from "@/features/tables/types";

/**
 * Invoice read path (Phase 5, §21, §31, §37). OWNER/STAFF, company-scoped. Balance
 * and overdue are computed on read (§21) — never stored columns.
 */

export type InvoiceListRow = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: string;
  paidAmount: string;
  balance: string;
  status: InvoiceStatus;
  dueDate: Date | null;
  overdue: boolean;
  currency: string;
};

export type InvoiceListResult = {
  rows: InvoiceListRow[];
  totalCount: number;
  params: TableParams;
};

type ParamSource = Record<string, string | string[] | undefined>;
function readParam(source: ParamSource, key: string): string | undefined {
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}
const STATUS_SET = new Set(["UNPAID", "PARTIAL", "PAID"]);

export async function getInvoices(source: ParamSource): Promise<InvoiceListResult> {
  const session = await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope(session);

  const parsed = parseTableParams(source, {
    allowedSort: ["invoiceNumber", "createdAt", "dueDate"],
    allowedFilters: [],
  });

  const status = readParam(source, "status");
  const search = readParam(source, "invoiceNumber")?.trim();

  const where: Prisma.InvoiceWhereInput = {
    organizationId,
    ...(status && STATUS_SET.has(status) ? { status: status as InvoiceStatus } : {}),
    ...(search ? { invoiceNumber: { contains: search, mode: "insensitive" } } : {}),
  };

  const [rows, totalCount] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: parsed.orderBy ?? { createdAt: "desc" },
      skip: parsed.skip,
      take: parsed.take,
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        paidAmount: true,
        status: true,
        dueDate: true,
        customer: { select: { name: true } },
        organization: { select: { currency: true } },
      },
    }),
    db.invoice.count({ where }),
  ]);

  const mapped: InvoiceListRow[] = rows.map((r) => {
    const amount = moneyToString(r.amount);
    const paidAmount = moneyToString(r.paidAmount);
    return {
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      customerName: r.customer.name,
      amount,
      paidAmount,
      balance: moneyToString(invoiceBalanceFromStrings(amount, paidAmount)),
      status: r.status,
      dueDate: r.dueDate,
      overdue: isInvoiceOverdue(r.status, r.dueDate),
      currency: r.organization.currency,
    };
  });

  // Time-based automation (§15.7): fire `invoice.overdue` lazily for the overdue
  // rows on this page. No-op (one indexed lookup) unless an overdue rule exists;
  // gated to once/day per invoice. Never throws.
  await fireOverdueOnRead(
    organizationId,
    mapped.filter((r) => r.overdue).map((r) => r.id),
  );

  return { rows: mapped, totalCount, params: parsed.params };
}

export type PaymentEntry = {
  id: string;
  amount: string;
  method: string;
  reference: string | null;
  paidAt: Date;
};

export type InvoiceDetail = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  amount: string;
  paidAmount: string;
  balance: string;
  overdue: boolean;
  dueDate: Date | null;
  issuedAt: Date | null;
  currency: string;
  customerId: string;
  customerName: string;
  jobId: string;
  payments: PaymentEntry[];
};

export async function getInvoiceById(id: string): Promise<InvoiceDetail | null> {
  const session = await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope(session);

  const invoice = await db.invoice.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      issuedAt: true,
      customerId: true,
      jobId: true,
      customer: { select: { name: true } },
      organization: { select: { currency: true } },
      payments: {
        orderBy: { paidAt: "desc" },
        select: { id: true, amount: true, method: true, reference: true, paidAt: true },
      },
    },
  });
  if (!invoice) return null;

  const amount = moneyToString(invoice.amount);
  const paidAmount = moneyToString(invoice.paidAmount);

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    amount,
    paidAmount,
    balance: moneyToString(invoiceBalanceFromStrings(amount, paidAmount)),
    overdue: isInvoiceOverdue(invoice.status, invoice.dueDate),
    dueDate: invoice.dueDate,
    issuedAt: invoice.issuedAt,
    currency: invoice.organization.currency,
    customerId: invoice.customerId,
    customerName: invoice.customer.name,
    jobId: invoice.jobId,
    payments: invoice.payments.map((p) => ({
      id: p.id,
      amount: moneyToString(p.amount),
      method: p.method,
      reference: p.reference,
      paidAt: p.paidAt,
    })),
  };
}

/** Job summary for the "create invoice" form (§21). */
export async function getJobForInvoice(
  jobId: string,
): Promise<{ id: string; customerName: string; quoteNumber: string; quoteTotal: string; currency: string } | null> {
  const session = await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope(session);
  const job = await db.job.findFirst({
    where: { id: jobId, organizationId },
    select: {
      id: true,
      customer: { select: { name: true } },
      quote: { select: { quoteNumber: true, total: true, currency: true } },
    },
  });
  if (!job) return null;
  return {
    id: job.id,
    customerName: job.customer.name,
    quoteNumber: job.quote.quoteNumber,
    quoteTotal: moneyToString(job.quote.total),
    currency: job.quote.currency,
  };
}
