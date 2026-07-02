import "server-only";

import type { InvoiceStatus, JobStatus, QuoteStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { getCompanyConfig } from "@/lib/config/service";
import { moneyToString, subtractFloorZero, toDecimal } from "@/lib/money";
import { getAttachmentsForEntity, type AttachmentView } from "@/features/files/queries";
import type { EntityType } from "@prisma/client";
import type { DocumentType } from "@/features/documents/types";
import type { PortalSession } from "@/features/customer-portal/session";

/**
 * Customer Portal read path (§12.6, §12.7, §12.8). Every query is scoped to
 * **exactly one** `customerId` within **exactly one** `organizationId`, both
 * taken from the verified portal session — never from a URL parameter. An id
 * that belongs to another customer or another organization simply returns
 * `null`/`[]` (a non-existent record from the portal's point of view), so there
 * is no IDOR surface and no enumeration oracle (§12.9, §12.10).
 *
 * The portal reads the frozen Phase 5 entities exactly as they are (§12.3) and
 * reuses the same `lib/money` Decimal-correct serialization the rest of the app
 * uses — it never recomputes a total. Money leaves here as canonical 2dp strings
 * so the portal's client components stay `Decimal`-free, like the public quote
 * view (`features/quotes/public.ts`).
 *
 * Draft quotes are never customer-facing and are excluded everywhere, the same
 * rule the public share link enforces.
 */

const VISIBLE_QUOTE_STATUSES: QuoteStatus[] = ["SENT", "VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"];

// --- Account ----------------------------------------------------------------

export type PortalAccount = {
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: {
    street?: string;
    city?: string;
    state?: string;
    postal?: string;
    country?: string;
  } | null;
  organizationName: string;
  currency: string;
};

export async function getPortalAccount(session: PortalSession): Promise<PortalAccount | null> {
  const customer = await db.customer.findFirst({
    where: { id: session.customerId, organizationId: session.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      organization: { select: { name: true } },
    },
  });
  if (!customer) return null;

  // Currency comes from the canonical Configuration Service — the portal never
  // reads `Organization.settings` directly (§5.5 single-reader rule).
  const config = await getCompanyConfig(session.organizationId);
  return {
    customerId: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: (customer.address as PortalAccount["address"]) ?? null,
    organizationName: customer.organization.name,
    currency: config.locale.currency,
  };
}

// --- Quotes -----------------------------------------------------------------

export type PortalQuoteSummary = {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  total: string;
  issueDate: Date | null;
  expiryDate: Date | null;
};

export type PortalQuoteDetail = PortalQuoteSummary & {
  currency: string;
  subtotal: string;
  taxAmount: string;
  discountType: "PERCENT" | "FIXED" | null;
  discountValue: string | null;
  notes: string | null;
  terms: string | null;
  /** True while the quote can still be accepted/declined by the customer. */
  decidable: boolean;
  items: { description: string; quantity: string; unitPrice: string; lineTotal: string }[];
};

export async function listPortalQuotes(session: PortalSession): Promise<PortalQuoteSummary[]> {
  const rows = await db.quote.findMany({
    where: {
      organizationId: session.organizationId,
      customerId: session.customerId,
      status: { in: VISIBLE_QUOTE_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      total: true,
      issueDate: true,
      expiryDate: true,
    },
  });
  return rows.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    total: moneyToString(q.total),
    issueDate: q.issueDate,
    expiryDate: q.expiryDate,
  }));
}

export async function getPortalQuote(
  session: PortalSession,
  quoteId: string,
): Promise<PortalQuoteDetail | null> {
  const quote = await db.quote.findFirst({
    where: {
      id: quoteId,
      organizationId: session.organizationId,
      customerId: session.customerId,
      status: { in: VISIBLE_QUOTE_STATUSES },
    },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      currency: true,
      subtotal: true,
      taxAmount: true,
      total: true,
      discountType: true,
      discountValue: true,
      issueDate: true,
      expiryDate: true,
      notes: true,
      terms: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: { description: true, quantity: true, unitPrice: true, lineTotal: true },
      },
    },
  });
  if (!quote) return null;

  return {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    currency: quote.currency,
    subtotal: moneyToString(quote.subtotal),
    taxAmount: moneyToString(quote.taxAmount),
    total: moneyToString(quote.total),
    discountType: quote.discountType,
    discountValue: quote.discountValue ? moneyToString(quote.discountValue) : null,
    issueDate: quote.issueDate,
    expiryDate: quote.expiryDate,
    notes: quote.notes,
    terms: quote.terms,
    decidable: quote.status === "SENT" || quote.status === "VIEWED",
    items: quote.items.map((it) => ({
      description: it.description,
      quantity: moneyToString(it.quantity),
      unitPrice: moneyToString(it.unitPrice),
      lineTotal: moneyToString(it.lineTotal),
    })),
  };
}

// --- Invoices ---------------------------------------------------------------

export type PortalInvoiceSummary = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  amount: string;
  paidAmount: string;
  balance: string;
  dueDate: Date | null;
  issuedAt: Date | null;
};

export type PortalPayment = {
  amount: string;
  method: string;
  reference: string | null;
  paidAt: Date;
};

export type PortalInvoiceDetail = PortalInvoiceSummary & {
  payments: PortalPayment[];
};

function invoiceBalance(amount: { toString(): string }, paidAmount: { toString(): string }): string {
  return moneyToString(subtractFloorZero(toDecimal(amount.toString()), toDecimal(paidAmount.toString())));
}

export async function listPortalInvoices(session: PortalSession): Promise<PortalInvoiceSummary[]> {
  const rows = await db.invoice.findMany({
    where: { organizationId: session.organizationId, customerId: session.customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      issuedAt: true,
    },
  });
  return rows.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    amount: moneyToString(inv.amount),
    paidAmount: moneyToString(inv.paidAmount),
    balance: invoiceBalance(inv.amount, inv.paidAmount),
    dueDate: inv.dueDate,
    issuedAt: inv.issuedAt,
  }));
}

export async function getPortalInvoice(
  session: PortalSession,
  invoiceId: string,
): Promise<PortalInvoiceDetail | null> {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId: session.organizationId, customerId: session.customerId },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      issuedAt: true,
      payments: {
        orderBy: { paidAt: "asc" },
        select: { amount: true, method: true, reference: true, paidAt: true },
      },
    },
  });
  if (!invoice) return null;

  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    amount: moneyToString(invoice.amount),
    paidAmount: moneyToString(invoice.paidAmount),
    balance: invoiceBalance(invoice.amount, invoice.paidAmount),
    dueDate: invoice.dueDate,
    issuedAt: invoice.issuedAt,
    payments: invoice.payments.map((p) => ({
      amount: moneyToString(p.amount),
      method: p.method,
      reference: p.reference,
      paidAt: p.paidAt,
    })),
  };
}

// --- Jobs -------------------------------------------------------------------

export type PortalJobSummary = {
  id: string;
  reference: string;
  status: JobStatus;
  scheduledDate: Date | null;
  completedAt: Date | null;
};

export type PortalJobDetail = PortalJobSummary & {
  scheduledEndAt: Date | null;
  /** Customer-safe completion / scheduling notes — never the internal Activity log. */
  notes: string | null;
  technicianName: string | null;
};

export async function listPortalJobs(session: PortalSession): Promise<PortalJobSummary[]> {
  const rows = await db.job.findMany({
    where: { organizationId: session.organizationId, customerId: session.customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      completedAt: true,
      quote: { select: { quoteNumber: true } },
    },
  });
  return rows.map((job) => ({
    id: job.id,
    reference: job.quote.quoteNumber,
    status: job.status,
    scheduledDate: job.scheduledDate,
    completedAt: job.completedAt,
  }));
}

export async function getPortalJob(
  session: PortalSession,
  jobId: string,
): Promise<PortalJobDetail | null> {
  const job = await db.job.findFirst({
    where: { id: jobId, organizationId: session.organizationId, customerId: session.customerId },
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      scheduledEndAt: true,
      completedAt: true,
      notes: true,
      quote: { select: { quoteNumber: true } },
      assignedTo: { select: { name: true } },
    },
  });
  if (!job) return null;

  return {
    id: job.id,
    reference: job.quote.quoteNumber,
    status: job.status,
    scheduledDate: job.scheduledDate,
    scheduledEndAt: job.scheduledEndAt,
    completedAt: job.completedAt,
    notes: job.notes,
    technicianName: job.assignedTo?.name ?? null,
  };
}

// --- Dashboard --------------------------------------------------------------

export type PortalDashboard = {
  account: PortalAccount;
  openQuotes: number;
  activeJobs: number;
  outstandingBalance: string;
  recentQuotes: PortalQuoteSummary[];
  recentInvoices: PortalInvoiceSummary[];
  recentJobs: PortalJobSummary[];
};

/**
 * The portal home summary (§12.5). A read-only roll-up of the customer's own
 * data — there is intentionally no internal Activity feed here: the Activity log
 * carries staff attribution and internal notes, so the "recent activity" surface
 * is derived from the customer's own latest Quotes/Invoices/Jobs instead (§12.8).
 */
export async function getPortalDashboard(session: PortalSession): Promise<PortalDashboard | null> {
  const account = await getPortalAccount(session);
  if (!account) return null;

  const [quotes, invoices, jobs] = await Promise.all([
    listPortalQuotes(session),
    listPortalInvoices(session),
    listPortalJobs(session),
  ]);

  const outstanding = invoices.reduce(
    (acc, inv) => acc.add(toDecimal(inv.balance)),
    toDecimal(0),
  );

  return {
    account,
    openQuotes: quotes.filter((q) => q.status === "SENT" || q.status === "VIEWED").length,
    activeJobs: jobs.filter((j) => j.status === "SCHEDULED" || j.status === "IN_PROGRESS").length,
    outstandingBalance: moneyToString(outstanding),
    recentQuotes: quotes.slice(0, 5),
    recentInvoices: invoices.slice(0, 5),
    recentJobs: jobs.slice(0, 5),
  };
}

// --- Document ownership (PDF download gate, §10.6, §10.8) --------------------

/**
 * Whether the portal session may download the given document. Only the
 * customer-facing financial documents are exposed through the portal — Quote,
 * Invoice, and Receipt. The internal Job Sheet / Work Order (operational, staff-
 * facing) are deliberately NOT portal-downloadable (§12.5 keeps jobs read-only
 * status; §5 keeps internal management out of the portal). Ownership is verified
 * by `customerId` + `organizationId`, never by the URL id alone.
 */
export async function portalOwnsDocument(
  session: PortalSession,
  type: DocumentType,
  id: string,
): Promise<boolean> {
  const where = { id, organizationId: session.organizationId, customerId: session.customerId };
  switch (type) {
    case "quote": {
      const quote = await db.quote.findFirst({
        where: { ...where, status: { in: VISIBLE_QUOTE_STATUSES } },
        select: { id: true },
      });
      return quote !== null;
    }
    case "invoice":
    case "receipt": {
      const invoice = await db.invoice.findFirst({ where, select: { id: true } });
      return invoice !== null;
    }
    case "job-sheet":
    case "work-order":
      return false;
  }
}

// --- File access (Step 3 integration, §12.6, §14) ---------------------------

/**
 * Read-only attachment access for the portal (§6 of the Step 4 brief). The
 * portal never uploads; it lists files on an entity it has first proven the
 * customer owns. Returns `null` (not `[]`) when the entity is not the customer's,
 * so the caller renders nothing rather than an empty list it might mistake for
 * "no files."
 */
export async function getPortalEntityFiles(
  session: PortalSession,
  entityType: Extract<EntityType, "QUOTE" | "INVOICE" | "JOB">,
  entityId: string,
): Promise<AttachmentView[] | null> {
  const owns = await portalOwnsEntity(session, entityType, entityId);
  if (!owns) return null;
  return getAttachmentsForEntity(session.organizationId, entityType, entityId);
}

/** Whether the (entityType, entityId) belongs to this portal customer. */
export async function portalOwnsEntity(
  session: PortalSession,
  entityType: "QUOTE" | "INVOICE" | "JOB",
  entityId: string,
): Promise<boolean> {
  const where = {
    id: entityId,
    organizationId: session.organizationId,
    customerId: session.customerId,
  };
  if (entityType === "QUOTE") {
    return (await db.quote.findFirst({ where, select: { id: true } })) !== null;
  }
  if (entityType === "INVOICE") {
    return (await db.invoice.findFirst({ where, select: { id: true } })) !== null;
  }
  return (await db.job.findFirst({ where, select: { id: true } })) !== null;
}
