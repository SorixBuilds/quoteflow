import type { Prisma, Role } from "@prisma/client";

import { db } from "@/lib/db";
import { getCompanyConfig } from "@/lib/config/service";
import { buildPdfBrand, type PdfBrand } from "@/lib/pdf/theme";
import { Decimal, roundMoney, subtractFloorZero, toDecimal } from "@/lib/money";
import { formatMoney, formatDocDate, formatAddressLines } from "@/lib/pdf/format";
import type {
  DocItem,
  DocParty,
  DocumentType,
  RenderModel,
} from "@/features/documents/types";

/**
 * Document data loader (Phase 6, §10.6, §10.7, §10.9). Turns an entity id into a
 * fully-formatted, serializable {@link RenderModel} — or `null` when the entity
 * is not found *in this session's scope* (the route maps `null` to a 404, never
 * confirming another tenant's record, §10.10).
 *
 * Every query is `WHERE id = ? AND organizationId = ?`; for the field-facing Job
 * documents an extra `AND assignedToId = ?` is added for a FIELD user, so a
 * technician can only render their own jobs (§10.8). The organization id is
 * re-derived from the session by the caller — never trusted from the URL (§10.9).
 */

export type DocumentScope = {
  organizationId: string;
  role: Role;
  userId: string;
};

/** Roles allowed to render each document type (§10.8). */
const ALLOWED_ROLES: Record<DocumentType, readonly Role[]> = {
  quote: ["OWNER", "STAFF"],
  invoice: ["OWNER", "STAFF"],
  receipt: ["OWNER", "STAFF"],
  "job-sheet": ["OWNER", "STAFF", "FIELD"],
  "work-order": ["OWNER", "STAFF", "FIELD"],
};

/** Whether a role may render this document type at all (before row-level scoping). */
export function canRenderType(type: DocumentType, role: Role): boolean {
  return ALLOWED_ROLES[type].includes(role);
}

export async function loadRenderModel(
  type: DocumentType,
  entityId: string,
  scope: DocumentScope,
): Promise<RenderModel | null> {
  // Coarse role gate first — a FIELD user can never render a Quote/Invoice/Receipt.
  if (!canRenderType(type, scope.role)) return null;

  switch (type) {
    case "quote":
      return loadQuote(entityId, scope);
    case "invoice":
      return loadInvoice(entityId, scope);
    case "receipt":
      return loadReceipt(entityId, scope);
    case "job-sheet":
      return loadJob(entityId, scope, "job-sheet");
    case "work-order":
      return loadJob(entityId, scope, "work-order");
  }
}

// --- shared helpers ---------------------------------------------------------

async function loadBrand(organizationId: string): Promise<PdfBrand | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, logoUrl: true },
  });
  if (!org) return null;
  const config = await getCompanyConfig(organizationId);
  return buildPdfBrand(org, config);
}

type CustomerLike = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: Prisma.JsonValue | null;
};

function customerParty(customer: CustomerLike): DocParty {
  return {
    name: customer.name,
    lines: [
      customer.email ?? "",
      customer.phone ?? "",
      ...formatAddressLines(customer.address ?? null),
    ].filter(Boolean),
  };
}

type ItemLike = {
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  taxRate: { name: string } | null;
};

function mapItems(items: ItemLike[], currency: string, withPrices = true): DocItem[] {
  return items.map((item) => ({
    description: item.description,
    quantity: new Decimal(item.quantity).toString(),
    unitPrice: withPrices ? formatMoney(item.unitPrice, currency) : "",
    tax: item.taxRate?.name ?? "—",
    amount: withPrices ? formatMoney(item.lineTotal, currency) : "",
  }));
}

/** The discount amount implied by a quote's discount type/value, for display. */
function discountAmount(
  discountType: "PERCENT" | "FIXED" | null,
  discountValue: Prisma.Decimal | null,
  subtotal: Prisma.Decimal,
): Prisma.Decimal | null {
  if (!discountType || discountValue === null) return null;
  if (discountType === "PERCENT") {
    return roundMoney(toDecimal(subtotal).mul(toDecimal(discountValue)).div(100));
  }
  return toDecimal(discountValue);
}

// --- per-type loaders -------------------------------------------------------

async function loadQuote(id: string, scope: DocumentScope): Promise<RenderModel | null> {
  const quote = await db.quote.findFirst({
    where: { id, organizationId: scope.organizationId },
    select: {
      quoteNumber: true,
      status: true,
      version: true,
      issueDate: true,
      expiryDate: true,
      subtotal: true,
      taxAmount: true,
      total: true,
      discountType: true,
      discountValue: true,
      notes: true,
      terms: true,
      customer: { select: { name: true, email: true, phone: true, address: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          description: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          taxRate: { select: { name: true } },
        },
      },
    },
  });
  if (!quote) return null;
  const brand = await loadBrand(scope.organizationId);
  if (!brand) return null;
  const currency = brand.currency;

  const totalLines = [{ label: "Subtotal", value: formatMoney(quote.subtotal, currency) }];
  const discount = discountAmount(quote.discountType, quote.discountValue, quote.subtotal);
  if (discount) {
    const label =
      quote.discountType === "PERCENT"
        ? `Discount (${new Decimal(quote.discountValue ?? 0).toString()}%)`
        : "Discount";
    totalLines.push({ label, value: `-${formatMoney(discount, currency)}` });
  }
  totalLines.push({ label: "Tax", value: formatMoney(quote.taxAmount, currency) });

  return {
    type: "quote",
    brand,
    doc: {
      number: quote.quoteNumber,
      status: quote.status,
      watermark: quote.status === "DRAFT" ? "DRAFT" : undefined,
      customer: customerParty(quote.customer),
      meta: [
        { key: "Issued", value: formatDocDate(quote.issueDate) },
        { key: "Valid until", value: formatDocDate(quote.expiryDate) },
        { key: "Version", value: `v${quote.version}` },
      ],
      items: mapItems(quote.items, currency),
      totalLines,
      grandTotal: { label: "Total", value: formatMoney(quote.total, currency) },
      notes: quote.notes,
      terms: quote.terms,
    },
  };
}

/** Load an invoice with the billed Job's accepted-quote line items. */
async function loadInvoiceRow(id: string, organizationId: string) {
  return db.invoice.findFirst({
    where: { id, organizationId },
    select: {
      invoiceNumber: true,
      amount: true,
      paidAmount: true,
      status: true,
      dueDate: true,
      issuedAt: true,
      customer: { select: { name: true, email: true, phone: true, address: true } },
      payments: {
        orderBy: { paidAt: "asc" },
        select: { amount: true, method: true, reference: true, paidAt: true },
      },
      job: {
        select: {
          notes: true,
          quote: {
            select: {
              items: {
                orderBy: { sortOrder: "asc" },
                select: {
                  description: true,
                  quantity: true,
                  unitPrice: true,
                  lineTotal: true,
                  taxRate: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

async function loadInvoice(id: string, scope: DocumentScope): Promise<RenderModel | null> {
  const invoice = await loadInvoiceRow(id, scope.organizationId);
  if (!invoice) return null;
  const brand = await loadBrand(scope.organizationId);
  if (!brand) return null;
  const currency = brand.currency;
  const balance = subtractFloorZero(toDecimal(invoice.amount), toDecimal(invoice.paidAmount));

  return {
    type: "invoice",
    brand,
    doc: {
      number: invoice.invoiceNumber,
      status: invoice.status,
      watermark: invoice.status === "PAID" ? "PAID" : undefined,
      customer: customerParty(invoice.customer),
      meta: [
        { key: "Issued", value: formatDocDate(invoice.issuedAt) },
        { key: "Due", value: formatDocDate(invoice.dueDate) },
      ],
      items: mapItems(invoice.job.quote?.items ?? [], currency),
      grandTotal: { label: "Invoice Total", value: formatMoney(invoice.amount, currency) },
      trailing: [
        { label: "Amount Paid", value: formatMoney(invoice.paidAmount, currency) },
        { label: "Balance Due", value: formatMoney(balance, currency) },
      ],
      notes: invoice.job.notes,
    },
  };
}

async function loadReceipt(id: string, scope: DocumentScope): Promise<RenderModel | null> {
  const invoice = await loadInvoiceRow(id, scope.organizationId);
  if (!invoice) return null;
  const brand = await loadBrand(scope.organizationId);
  if (!brand) return null;
  const currency = brand.currency;
  const balance = subtractFloorZero(toDecimal(invoice.amount), toDecimal(invoice.paidAmount));

  return {
    type: "receipt",
    brand,
    doc: {
      number: invoice.invoiceNumber,
      watermark: balance.isZero() ? "PAID" : undefined,
      customer: customerParty(invoice.customer),
      meta: [{ key: "Invoice", value: invoice.invoiceNumber }],
      payments: invoice.payments.map((p) => ({
        date: formatDocDate(p.paidAt),
        method: p.method,
        reference: p.reference ?? "—",
        amount: formatMoney(p.amount, currency),
      })),
      totalLines: [
        { label: "Invoice Total", value: formatMoney(invoice.amount, currency) },
        { label: "Balance Due", value: formatMoney(balance, currency) },
      ],
      grandTotal: { label: "Total Paid", value: formatMoney(invoice.paidAmount, currency) },
    },
  };
}

async function loadJob(
  id: string,
  scope: DocumentScope,
  variant: "job-sheet" | "work-order",
): Promise<RenderModel | null> {
  const where: Prisma.JobWhereInput =
    scope.role === "FIELD"
      ? { id, organizationId: scope.organizationId, assignedToId: scope.userId }
      : { id, organizationId: scope.organizationId };

  const job = await db.job.findFirst({
    where,
    select: {
      status: true,
      scheduledDate: true,
      scheduledEndAt: true,
      notes: true,
      assignedTo: { select: { name: true } },
      customer: { select: { name: true, email: true, phone: true, address: true } },
      quote: {
        select: {
          quoteNumber: true,
          subtotal: true,
          taxAmount: true,
          total: true,
          terms: true,
          items: {
            orderBy: { sortOrder: "asc" },
            select: {
              description: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
              taxRate: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!job) return null;
  const brand = await loadBrand(scope.organizationId);
  if (!brand) return null;
  const currency = brand.currency;

  const meta = [
    { key: "Scheduled", value: formatDocDate(job.scheduledDate) },
    { key: "Ends", value: formatDocDate(job.scheduledEndAt) },
    { key: "Technician", value: job.assignedTo?.name ?? "Unassigned" },
  ];

  const priced = variant === "work-order";
  return {
    type: variant,
    brand,
    doc: {
      number: job.quote.quoteNumber,
      status: job.status,
      customer: customerParty(job.customer),
      meta,
      items: mapItems(job.quote.items, currency, priced),
      totalLines: priced
        ? [
            { label: "Subtotal", value: formatMoney(job.quote.subtotal, currency) },
            { label: "Tax", value: formatMoney(job.quote.taxAmount, currency) },
          ]
        : undefined,
      grandTotal: priced
        ? { label: "Total", value: formatMoney(job.quote.total, currency) }
        : undefined,
      notes: job.notes,
      terms: priced ? job.quote.terms : undefined,
    },
  };
}
