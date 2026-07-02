import type { EmailBrand } from "@/features/email/branding";
import {
  renderHtml,
  renderText,
  type TemplateBody,
} from "@/features/email/templates/layout";

/**
 * Email template registry (Phase 6B Step 5, §2, §3, §11.6).
 *
 * One pure function per supported event. Each receives an already-formatted,
 * markup-free data payload (money/dates formatted server-side by the dispatch
 * layer, exactly as the PDF templates receive pre-formatted strings, §10) plus
 * the tenant `EmailBrand`, and returns a structured {@link TemplateBody}. The
 * layout — not the template — produces HTML and escapes every value (§11.9), so
 * a template can never emit unescaped input.
 *
 * Adding an eleventh event is one data type + one case here; nothing else
 * changes (the additive discipline the whole platform follows).
 */

/** The closed set of template identifiers (the `EmailLog.templateType` value). */
export const EMAIL_TEMPLATES = {
  portalInvitation: "portal_invitation",
  portalLogin: "portal_login",
  quoteShared: "quote_shared",
  quoteAccepted: "quote_accepted",
  quoteDeclined: "quote_declined",
  invoiceIssued: "invoice_issued",
  paymentReceived: "payment_received",
  jobScheduled: "job_scheduled",
  jobCompleted: "job_completed",
  generalNotification: "general_notification",
} as const;

export type EmailTemplateType =
  (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES];

// --- per-template data payloads (all strings already formatted) -------------

export type PortalInvitationData = {
  customerName: string;
  portalUrl: string;
  expiresLabel: string;
};
export type PortalLoginData = {
  customerName: string;
  loginUrl: string;
  expiresLabel: string;
};
export type QuoteSharedData = {
  customerName: string;
  quoteNumber: string;
  total: string;
  expiryLabel: string | null;
  viewUrl: string | null;
};
export type QuoteAcceptedData = {
  customerName: string;
  quoteNumber: string;
  total: string;
};
export type QuoteDeclinedData = {
  customerName: string;
  quoteNumber: string;
};
export type InvoiceIssuedData = {
  customerName: string;
  invoiceNumber: string;
  total: string;
  balance: string;
  dueLabel: string | null;
  viewUrl: string | null;
};
export type PaymentReceivedData = {
  customerName: string;
  invoiceNumber: string;
  amountPaid: string;
  balance: string;
};
export type JobScheduledData = {
  customerName: string;
  reference: string;
  scheduledLabel: string;
  technician: string | null;
};
export type JobCompletedData = {
  customerName: string;
  reference: string;
  notes: string | null;
};
export type GeneralNotificationData = {
  recipientName: string;
  title: string;
  message: string;
  actionLabel: string | null;
  actionUrl: string | null;
};

/** Discriminated input accepted by the rendering pipeline. */
export type EmailTemplateInput =
  | { type: typeof EMAIL_TEMPLATES.portalInvitation; data: PortalInvitationData }
  | { type: typeof EMAIL_TEMPLATES.portalLogin; data: PortalLoginData }
  | { type: typeof EMAIL_TEMPLATES.quoteShared; data: QuoteSharedData }
  | { type: typeof EMAIL_TEMPLATES.quoteAccepted; data: QuoteAcceptedData }
  | { type: typeof EMAIL_TEMPLATES.quoteDeclined; data: QuoteDeclinedData }
  | { type: typeof EMAIL_TEMPLATES.invoiceIssued; data: InvoiceIssuedData }
  | { type: typeof EMAIL_TEMPLATES.paymentReceived; data: PaymentReceivedData }
  | { type: typeof EMAIL_TEMPLATES.jobScheduled; data: JobScheduledData }
  | { type: typeof EMAIL_TEMPLATES.jobCompleted; data: JobCompletedData }
  | { type: typeof EMAIL_TEMPLATES.generalNotification; data: GeneralNotificationData };

const greeting = (name: string): string =>
  name.trim() ? `Hi ${name.trim()},` : "Hello,";

// --- template functions -----------------------------------------------------

function portalInvitation(d: PortalInvitationData, brand: EmailBrand): TemplateBody {
  return {
    subject: `${brand.companyName} — your customer portal access`,
    preheader: "View your quotes, invoices, and job updates in one place.",
    heading: "Your customer portal is ready",
    blocks: [
      { type: "paragraph", text: greeting(d.customerName) },
      {
        type: "paragraph",
        text: `${brand.companyName} has invited you to their customer portal, where you can review quotes, accept or decline them, view invoices and payment history, and track your jobs.`,
      },
      { type: "note", text: `This invitation link expires ${d.expiresLabel}.` },
    ],
    cta: { label: "Open your portal", url: d.portalUrl },
  };
}

function portalLogin(d: PortalLoginData, brand: EmailBrand): TemplateBody {
  return {
    subject: `${brand.companyName} — your secure sign-in link`,
    preheader: "Use this secure link to sign in to your portal.",
    heading: "Sign in to your portal",
    blocks: [
      { type: "paragraph", text: greeting(d.customerName) },
      {
        type: "paragraph",
        text: "Use the secure button below to sign in. Do not share this link — anyone with it can access your portal.",
      },
      { type: "note", text: `This sign-in link expires ${d.expiresLabel}.` },
    ],
    cta: { label: "Sign in", url: d.loginUrl },
  };
}

function quoteShared(d: QuoteSharedData, brand: EmailBrand): TemplateBody {
  const blocks: TemplateBody["blocks"] = [
    { type: "paragraph", text: greeting(d.customerName) },
    {
      type: "paragraph",
      text: `Thank you for your interest. Your quote ${d.quoteNumber} from ${brand.companyName} is attached as a PDF, with a summary below.`,
    },
    {
      type: "keyValue",
      rows: [
        { label: "Quote", value: d.quoteNumber },
        ...(d.expiryLabel ? [{ label: "Valid until", value: d.expiryLabel }] : []),
      ],
    },
    { type: "total", label: "Total", value: d.total },
  ];
  return {
    subject: `Your quote ${d.quoteNumber} from ${brand.companyName}`,
    preheader: `Quote ${d.quoteNumber} — ${d.total}`,
    heading: `Quote ${d.quoteNumber}`,
    blocks,
    cta: d.viewUrl ? { label: "Review & respond", url: d.viewUrl } : undefined,
  };
}

function quoteAccepted(d: QuoteAcceptedData, brand: EmailBrand): TemplateBody {
  return {
    subject: `Quote ${d.quoteNumber} accepted — thank you`,
    preheader: "We've received your acceptance and will be in touch.",
    heading: "Thanks — your quote is accepted",
    blocks: [
      { type: "paragraph", text: greeting(d.customerName) },
      {
        type: "paragraph",
        text: `We've recorded your acceptance of quote ${d.quoteNumber} (${d.total}). ${brand.companyName} will be in touch shortly to schedule the work.`,
      },
    ],
  };
}

function quoteDeclined(d: QuoteDeclinedData, brand: EmailBrand): TemplateBody {
  return {
    subject: `Quote ${d.quoteNumber} declined`,
    preheader: "We've recorded your response.",
    heading: "Your response has been recorded",
    blocks: [
      { type: "paragraph", text: greeting(d.customerName) },
      {
        type: "paragraph",
        text: `We've recorded that you declined quote ${d.quoteNumber}. If this was a mistake or you'd like to revisit it, just reply to this email and ${brand.companyName} will be happy to help.`,
      },
    ],
  };
}

function invoiceIssued(d: InvoiceIssuedData, brand: EmailBrand): TemplateBody {
  return {
    subject: `Invoice ${d.invoiceNumber} from ${brand.companyName}`,
    preheader: `Invoice ${d.invoiceNumber} — balance due ${d.balance}`,
    heading: `Invoice ${d.invoiceNumber}`,
    blocks: [
      { type: "paragraph", text: greeting(d.customerName) },
      {
        type: "paragraph",
        text: `Please find invoice ${d.invoiceNumber} attached as a PDF. A summary is below.`,
      },
      {
        type: "keyValue",
        rows: [
          { label: "Invoice total", value: d.total },
          ...(d.dueLabel ? [{ label: "Due", value: d.dueLabel }] : []),
        ],
      },
      { type: "total", label: "Balance due", value: d.balance },
    ],
    cta: d.viewUrl ? { label: "View invoice", url: d.viewUrl } : undefined,
  };
}

function paymentReceived(d: PaymentReceivedData, brand: EmailBrand): TemplateBody {
  return {
    subject: `Payment received — invoice ${d.invoiceNumber}`,
    preheader: `Thank you — we've received your payment of ${d.amountPaid}.`,
    heading: "Payment received — thank you",
    blocks: [
      { type: "paragraph", text: greeting(d.customerName) },
      {
        type: "paragraph",
        text: `Thank you. ${brand.companyName} has received your payment of ${d.amountPaid} toward invoice ${d.invoiceNumber}. Your receipt is attached.`,
      },
      {
        type: "keyValue",
        rows: [
          { label: "Amount paid", value: d.amountPaid },
          { label: "Remaining balance", value: d.balance },
        ],
      },
    ],
  };
}

function jobScheduled(d: JobScheduledData, brand: EmailBrand): TemplateBody {
  return {
    subject: `Your job is scheduled — ${d.reference}`,
    preheader: `Scheduled for ${d.scheduledLabel}.`,
    heading: "Your job is scheduled",
    blocks: [
      { type: "paragraph", text: greeting(d.customerName) },
      {
        type: "paragraph",
        text: `${brand.companyName} has scheduled your job (${d.reference}). Details are below.`,
      },
      {
        type: "keyValue",
        rows: [
          { label: "Scheduled for", value: d.scheduledLabel },
          ...(d.technician ? [{ label: "Technician", value: d.technician }] : []),
        ],
      },
    ],
  };
}

function jobCompleted(d: JobCompletedData, brand: EmailBrand): TemplateBody {
  const blocks: TemplateBody["blocks"] = [
    { type: "paragraph", text: greeting(d.customerName) },
    {
      type: "paragraph",
      text: `Your job (${d.reference}) has been completed. Thank you for choosing ${brand.companyName}.`,
    },
  ];
  if (d.notes) blocks.push({ type: "note", text: d.notes });
  return {
    subject: `Your job is complete — ${d.reference}`,
    preheader: "Your job has been completed.",
    heading: "Your job is complete",
    blocks,
  };
}

function generalNotification(d: GeneralNotificationData): TemplateBody {
  return {
    subject: d.title,
    preheader: d.message.slice(0, 120),
    heading: d.title,
    blocks: [
      { type: "paragraph", text: greeting(d.recipientName) },
      { type: "paragraph", text: d.message },
    ],
    cta:
      d.actionLabel && d.actionUrl
        ? { label: d.actionLabel, url: d.actionUrl }
        : undefined,
  };
}

/** Build the structured body for a template input (pure; the test seam). */
export function buildTemplateBody(
  input: EmailTemplateInput,
  brand: EmailBrand,
): TemplateBody {
  switch (input.type) {
    case EMAIL_TEMPLATES.portalInvitation:
      return portalInvitation(input.data, brand);
    case EMAIL_TEMPLATES.portalLogin:
      return portalLogin(input.data, brand);
    case EMAIL_TEMPLATES.quoteShared:
      return quoteShared(input.data, brand);
    case EMAIL_TEMPLATES.quoteAccepted:
      return quoteAccepted(input.data, brand);
    case EMAIL_TEMPLATES.quoteDeclined:
      return quoteDeclined(input.data, brand);
    case EMAIL_TEMPLATES.invoiceIssued:
      return invoiceIssued(input.data, brand);
    case EMAIL_TEMPLATES.paymentReceived:
      return paymentReceived(input.data, brand);
    case EMAIL_TEMPLATES.jobScheduled:
      return jobScheduled(input.data, brand);
    case EMAIL_TEMPLATES.jobCompleted:
      return jobCompleted(input.data, brand);
    case EMAIL_TEMPLATES.generalNotification:
      return generalNotification(input.data);
  }
}

/** A fully rendered message: subject + HTML + plain-text alternative. */
export type RenderedTemplate = { subject: string; html: string; text: string };

/**
 * Render a template to its subject/HTML/text. The single entry point the Email
 * Service calls — deterministic given the same input + brand (§3, §11.12).
 */
export function renderTemplate(
  input: EmailTemplateInput,
  brand: EmailBrand,
): RenderedTemplate {
  const body = buildTemplateBody(input, brand);
  return {
    subject: body.subject,
    html: renderHtml(body, brand),
    text: renderText(body, brand),
  };
}
