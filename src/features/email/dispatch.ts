import "server-only";

import type { EntityType } from "@prisma/client";

import { db } from "@/lib/db";
import { getCompanyConfig } from "@/lib/config/service";
import { formatMoney, subtractFloorZero, toDecimal } from "@/lib/money";
import { formatDocDate } from "@/lib/pdf/format";
import { renderDocument } from "@/features/documents/render";
import type { DocumentType } from "@/features/documents/types";
import type { EmailAttachment } from "@/features/email/providers/types";
import { EMAIL_TEMPLATES, type EmailTemplateInput } from "@/features/email/templates";
import { sendTemplatedEmail, type SentEmail } from "@/features/email/send";

/**
 * Email dispatch helpers (Phase 6B Step 5, §5–§7).
 *
 * The bridge between a completed business event and {@link sendTemplatedEmail}.
 * Each `build*Email` loads exactly the data a template needs, formats money/dates
 * **server-side** (the same currency-aware path the PDFs use, never duplicated —
 * §11), and resolves any PDF attachment through the existing Document Engine
 * (`renderDocument`, §10) — so an email never re-implements a calculation or a
 * render. The thin `notify*` wrappers are what the Phase 5 actions call as a
 * final, additive, non-fatal line; they return the `SentEmail` (or null) and
 * never throw.
 *
 * Builders return `null` when there is no one to email (e.g. the customer has no
 * address on file) — a missing recipient is a no-op, not an error.
 */

/** A ready-to-send unit of work — what a builder returns and a retry replays. */
export type EmailJob = {
  to: string;
  template: EmailTemplateInput;
  relatedEntityType: EntityType;
  relatedEntityId: string;
  attachments?: EmailAttachment[];
};

/**
 * A synthetic org-scoped, OWNER-role scope for server-triggered document
 * rendering. `renderDocument` only consults `id` for FIELD-user job scoping
 * (never reached at OWNER), and re-derives org from this object — it is never a
 * real user identity and grants nothing beyond the org the caller already proved.
 */
function systemScope(organizationId: string) {
  return { id: "system", organizationId, role: "OWNER" as const };
}

async function renderPdfAttachment(
  type: DocumentType,
  entityId: string,
  organizationId: string,
): Promise<EmailAttachment | null> {
  const doc = await renderDocument(type, entityId, systemScope(organizationId));
  if (!doc) return null;
  return { filename: doc.filename, content: doc.buffer, contentType: "application/pdf" };
}

async function currencyFor(organizationId: string): Promise<string> {
  return (await getCompanyConfig(organizationId)).locale.currency;
}

// --- Quote (§5) -------------------------------------------------------------

/** Quote shared/sent: branded summary + the Quote PDF, with a portal CTA. */
export async function buildQuoteSharedEmail(
  organizationId: string,
  quoteId: string,
): Promise<EmailJob | null> {
  const quote = await db.quote.findFirst({
    where: { id: quoteId, organizationId },
    select: {
      quoteNumber: true,
      total: true,
      expiryDate: true,
      customer: { select: { name: true, email: true } },
    },
  });
  if (!quote?.customer.email) return null;
  const currency = await currencyFor(organizationId);
  const attachment = await renderPdfAttachment("quote", quoteId, organizationId);

  return {
    to: quote.customer.email,
    relatedEntityType: "QUOTE",
    relatedEntityId: quoteId,
    attachments: attachment ? [attachment] : undefined,
    template: {
      type: EMAIL_TEMPLATES.quoteShared,
      data: {
        customerName: quote.customer.name,
        quoteNumber: quote.quoteNumber,
        total: formatMoney(quote.total, currency),
        expiryLabel: quote.expiryDate ? formatDocDate(quote.expiryDate) : null,
        viewUrl: null,
      },
    },
  };
}

/** Quote accepted/declined confirmation to the customer. */
export async function buildQuoteDecisionEmail(
  organizationId: string,
  quoteId: string,
  decision: "accepted" | "declined",
): Promise<EmailJob | null> {
  const quote = await db.quote.findFirst({
    where: { id: quoteId, organizationId },
    select: {
      quoteNumber: true,
      total: true,
      customer: { select: { name: true, email: true } },
    },
  });
  if (!quote?.customer.email) return null;
  const currency = await currencyFor(organizationId);

  const template: EmailTemplateInput =
    decision === "accepted"
      ? {
          type: EMAIL_TEMPLATES.quoteAccepted,
          data: {
            customerName: quote.customer.name,
            quoteNumber: quote.quoteNumber,
            total: formatMoney(quote.total, currency),
          },
        }
      : {
          type: EMAIL_TEMPLATES.quoteDeclined,
          data: {
            customerName: quote.customer.name,
            quoteNumber: quote.quoteNumber,
          },
        };

  return {
    to: quote.customer.email,
    relatedEntityType: "QUOTE",
    relatedEntityId: quoteId,
    template,
  };
}

// --- Invoice (§6) -----------------------------------------------------------

/** Invoice issued: branded summary + the Invoice PDF. */
export async function buildInvoiceIssuedEmail(
  organizationId: string,
  invoiceId: string,
): Promise<EmailJob | null> {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    select: {
      invoiceNumber: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      customer: { select: { name: true, email: true } },
    },
  });
  if (!invoice?.customer.email) return null;
  const currency = await currencyFor(organizationId);
  const balance = subtractFloorZero(toDecimal(invoice.amount), toDecimal(invoice.paidAmount));
  const attachment = await renderPdfAttachment("invoice", invoiceId, organizationId);

  return {
    to: invoice.customer.email,
    relatedEntityType: "INVOICE",
    relatedEntityId: invoiceId,
    attachments: attachment ? [attachment] : undefined,
    template: {
      type: EMAIL_TEMPLATES.invoiceIssued,
      data: {
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoiceNumber,
        total: formatMoney(invoice.amount, currency),
        balance: formatMoney(balance, currency),
        dueLabel: invoice.dueDate ? formatDocDate(invoice.dueDate) : null,
        viewUrl: null,
      },
    },
  };
}

/** Payment received: confirmation + the Receipt PDF (current paid/balance). */
export async function buildPaymentReceivedEmail(
  organizationId: string,
  invoiceId: string,
): Promise<EmailJob | null> {
  const invoice = await db.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    select: {
      invoiceNumber: true,
      amount: true,
      paidAmount: true,
      customer: { select: { name: true, email: true } },
    },
  });
  if (!invoice?.customer.email) return null;
  const currency = await currencyFor(organizationId);
  const balance = subtractFloorZero(toDecimal(invoice.amount), toDecimal(invoice.paidAmount));
  const attachment = await renderPdfAttachment("receipt", invoiceId, organizationId);

  return {
    to: invoice.customer.email,
    relatedEntityType: "INVOICE",
    relatedEntityId: invoiceId,
    attachments: attachment ? [attachment] : undefined,
    template: {
      type: EMAIL_TEMPLATES.paymentReceived,
      data: {
        customerName: invoice.customer.name,
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: formatMoney(invoice.paidAmount, currency),
        balance: formatMoney(balance, currency),
      },
    },
  };
}

// --- Job (§7) ---------------------------------------------------------------

/** Job scheduled/rescheduled notification to the customer. */
export async function buildJobScheduledEmail(
  organizationId: string,
  jobId: string,
): Promise<EmailJob | null> {
  const job = await db.job.findFirst({
    where: { id: jobId, organizationId },
    select: {
      scheduledDate: true,
      assignedTo: { select: { name: true } },
      customer: { select: { name: true, email: true } },
      quote: { select: { quoteNumber: true } },
    },
  });
  if (!job?.customer.email || !job.scheduledDate) return null;

  return {
    to: job.customer.email,
    relatedEntityType: "JOB",
    relatedEntityId: jobId,
    template: {
      type: EMAIL_TEMPLATES.jobScheduled,
      data: {
        customerName: job.customer.name,
        reference: job.quote.quoteNumber,
        scheduledLabel: formatDocDate(job.scheduledDate),
        technician: job.assignedTo?.name ?? null,
      },
    },
  };
}

/** Job completed notification to the customer. */
export async function buildJobCompletedEmail(
  organizationId: string,
  jobId: string,
): Promise<EmailJob | null> {
  const job = await db.job.findFirst({
    where: { id: jobId, organizationId },
    select: {
      notes: true,
      customer: { select: { name: true, email: true } },
      quote: { select: { quoteNumber: true } },
    },
  });
  if (!job?.customer.email) return null;

  return {
    to: job.customer.email,
    relatedEntityType: "JOB",
    relatedEntityId: jobId,
    template: {
      type: EMAIL_TEMPLATES.jobCompleted,
      data: {
        customerName: job.customer.name,
        reference: job.quote.quoteNumber,
        notes: job.notes,
      },
    },
  };
}

/**
 * Re-derive an {@link EmailJob} for a retry (§11.10) from a failed log's
 * template + related entity — rendered fresh, never from stored HTML. Returns
 * null for templates whose content cannot be reconstructed from the entity alone
 * (the token-bearing portal links, the entity-less general notification), which
 * is why the Retry control is offered only for the entity-derived emails.
 */
export async function rebuildEmailJob(
  organizationId: string,
  log: { templateType: string; relatedEntityId: string | null },
): Promise<EmailJob | null> {
  const id = log.relatedEntityId;
  if (!id) return null;
  switch (log.templateType) {
    case EMAIL_TEMPLATES.quoteShared:
      return buildQuoteSharedEmail(organizationId, id);
    case EMAIL_TEMPLATES.quoteAccepted:
      return buildQuoteDecisionEmail(organizationId, id, "accepted");
    case EMAIL_TEMPLATES.quoteDeclined:
      return buildQuoteDecisionEmail(organizationId, id, "declined");
    case EMAIL_TEMPLATES.invoiceIssued:
      return buildInvoiceIssuedEmail(organizationId, id);
    case EMAIL_TEMPLATES.paymentReceived:
      return buildPaymentReceivedEmail(organizationId, id);
    case EMAIL_TEMPLATES.jobScheduled:
      return buildJobScheduledEmail(organizationId, id);
    case EMAIL_TEMPLATES.jobCompleted:
      return buildJobCompletedEmail(organizationId, id);
    default:
      return null;
  }
}

/** Whether a template type can be retried (re-derived from its related entity). */
export function isRetryableTemplate(templateType: string): boolean {
  return (
    [
      EMAIL_TEMPLATES.quoteShared,
      EMAIL_TEMPLATES.quoteAccepted,
      EMAIL_TEMPLATES.quoteDeclined,
      EMAIL_TEMPLATES.invoiceIssued,
      EMAIL_TEMPLATES.paymentReceived,
      EMAIL_TEMPLATES.jobScheduled,
      EMAIL_TEMPLATES.jobCompleted,
    ] as string[]
  ).includes(templateType);
}

// --- thin non-fatal wrappers the Phase 5 actions call -----------------------

async function send(organizationId: string, job: EmailJob | null): Promise<SentEmail | null> {
  if (!job) return null;
  return sendTemplatedEmail({ organizationId, ...job });
}

export async function notifyQuoteShared(organizationId: string, quoteId: string) {
  return send(organizationId, await buildQuoteSharedEmail(organizationId, quoteId));
}
export async function notifyQuoteDecision(
  organizationId: string,
  quoteId: string,
  decision: "accepted" | "declined",
) {
  return send(organizationId, await buildQuoteDecisionEmail(organizationId, quoteId, decision));
}
export async function notifyInvoiceIssued(organizationId: string, invoiceId: string) {
  return send(organizationId, await buildInvoiceIssuedEmail(organizationId, invoiceId));
}
export async function notifyPaymentReceived(organizationId: string, invoiceId: string) {
  return send(organizationId, await buildPaymentReceivedEmail(organizationId, invoiceId));
}
export async function notifyJobScheduled(organizationId: string, jobId: string) {
  return send(organizationId, await buildJobScheduledEmail(organizationId, jobId));
}
export async function notifyJobCompleted(organizationId: string, jobId: string) {
  return send(organizationId, await buildJobCompletedEmail(organizationId, jobId));
}

// --- Portal invitation (§4) -------------------------------------------------

/**
 * Send a portal-invitation email carrying the one-time login link (§4). The URL
 * embeds the token plaintext, which is shown exactly once and never stored — so
 * this is dispatched inline at issuance time (it cannot be re-derived/retried
 * from the entity, unlike the quote/invoice/job emails). Org-scoped; the staff
 * action has already proven the customer belongs to the org.
 */
export async function notifyPortalInvitation(
  organizationId: string,
  input: { customerId: string; customerName: string; to: string; portalUrl: string; expiresAt: Date },
): Promise<SentEmail | null> {
  return sendTemplatedEmail({
    organizationId,
    to: input.to,
    relatedEntityType: "CUSTOMER",
    relatedEntityId: input.customerId,
    template: {
      type: EMAIL_TEMPLATES.portalInvitation,
      data: {
        customerName: input.customerName,
        portalUrl: input.portalUrl,
        expiresLabel: formatDocDate(input.expiresAt),
      },
    },
  });
}
