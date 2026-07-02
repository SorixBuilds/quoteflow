/**
 * Prompt builders (Phase 6B Step 9, §16.6, §16.9).
 *
 * Pure string composition over **pre-scoped, server-loaded** data: every
 * builder receives a plain object the action already fetched under the
 * caller's `organizationId` — never a raw client-supplied id resolved in here.
 * That closes the prompt-injection-via-cross-tenant-data class of risk by
 * construction (§16.9): nothing in this module can reach the database at all.
 *
 * Prompts ask for plain text (no markdown) because the suggestion lands in an
 * existing plain-text field (quote notes, job notes) via the existing save
 * action — AI proposes, the validated business action disposes (§16.6).
 */

export type QuotePromptContext = {
  leadName: string;
  leadPhone: string;
  leadEmail: string | null;
  sourceName: string | null;
  customerName: string | null;
};

/** Prompt for a quote-notes draft, built from a pre-scoped Lead (§16.6). */
export function buildQuotePrompt(context: QuotePromptContext): string {
  const facts = [
    `Lead name: ${context.leadName}`,
    `Phone: ${context.leadPhone}`,
    context.leadEmail ? `Email: ${context.leadEmail}` : null,
    context.sourceName ? `Lead source: ${context.sourceName}` : null,
    context.customerName ? `Existing customer record: ${context.customerName}` : null,
  ].filter((line): line is string => line !== null);

  return [
    "You are helping a field-service business draft the customer-facing notes",
    "section of a new quote. Write 2-4 short, professional sentences a customer",
    "will read: thank them for the enquiry, reference what is being quoted, and",
    "state that the line items and totals are detailed above. Plain text only,",
    "no markdown, no placeholders, no pricing (the quote itself carries prices).",
    "",
    "Context:",
    ...facts,
  ].join("\n");
}

export type JobSummaryPromptContext = {
  customerName: string;
  quoteNumber: string;
  status: string;
  scheduledDate: string | null;
  completedAt: string | null;
  existingNotes: string | null;
};

/** Prompt for a job work-summary draft, built from a pre-scoped Job (§16.5). */
export function buildJobSummaryPrompt(context: JobSummaryPromptContext): string {
  const facts = [
    `Customer: ${context.customerName}`,
    `Quote number: ${context.quoteNumber}`,
    `Job status: ${context.status}`,
    context.scheduledDate ? `Scheduled: ${context.scheduledDate}` : null,
    context.completedAt ? `Completed: ${context.completedAt}` : null,
    context.existingNotes ? `Technician's raw notes so far: ${context.existingNotes}` : null,
  ].filter((line): line is string => line !== null);

  return [
    "You are helping a field technician write a clear completion summary for a",
    "job record. Write 2-4 short sentences summarizing the work performed and",
    "its outcome, suitable for the office and the customer file. Plain text",
    "only, no markdown. If raw notes are provided, clean them up and keep every",
    "factual detail; do not invent work that is not mentioned.",
    "",
    "Context:",
    ...facts,
  ].join("\n");
}
