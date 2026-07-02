import type { EmailStatus } from "@/features/email/validation";

/**
 * Presentation labels for the Email History UI (§11.5, §13). Pure maps, safe to
 * import from server or client components. Template identifiers and statuses are
 * developer strings (`quote_shared`, `SIMULATED`); these turn them into the
 * human-facing copy staff actually read.
 */

export const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  portal_invitation: "Portal invitation",
  portal_login: "Portal sign-in link",
  quote_shared: "Quote sent",
  quote_accepted: "Quote accepted",
  quote_declined: "Quote declined",
  invoice_issued: "Invoice issued",
  payment_received: "Payment received",
  job_scheduled: "Job scheduled",
  job_completed: "Job completed",
  general_notification: "Notification",
};

export function emailTemplateLabel(templateType: string): string {
  return EMAIL_TEMPLATE_LABELS[templateType] ?? templateType;
}

/** Tailwind color classes per delivery status (matches the StatusBadge palette). */
export const EMAIL_STATUS_COLORS: Record<EmailStatus, string> = {
  QUEUED: "bg-slate-100 text-slate-700",
  SIMULATED: "bg-indigo-100 text-indigo-700",
  SENT: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  BOUNCED: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-700",
};

export const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  QUEUED: "Queued",
  SIMULATED: "Simulated",
  SENT: "Sent",
  DELIVERED: "Delivered",
  BOUNCED: "Bounced",
  FAILED: "Failed",
};
