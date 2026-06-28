import type {
  InvoiceStatus,
  JobStatus,
  LeadStatus,
  QuoteStatus,
} from "@prisma/client";

import type { Decimal } from "@/lib/money";

/**
 * Status lifecycle definitions (Phase 5, §22). The single source of truth for
 * which transitions are legal for Lead, Quote, and Job. Every status-changing
 * server action checks `canTransition(...)` before its conditional update, and
 * the `<StatusTransitionMenu>` renders only the targets `nextStatuses(...)`
 * returns — so the UI and the server agree by construction.
 *
 * Invoice status is intentionally absent from the transition maps: it is never
 * set directly, only derived from the Payment sum (§21) by `deriveInvoiceStatus`.
 *
 * Pure module — no Prisma, no auth — directly unit-tested (§40).
 */

export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "LOST"],
  CONTACTED: ["QUOTED", "LOST"],
  QUOTED: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

export const QUOTE_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  DRAFT: ["SENT", "EXPIRED"],
  SENT: ["VIEWED", "ACCEPTED", "DECLINED", "EXPIRED"],
  VIEWED: ["ACCEPTED", "DECLINED", "EXPIRED"],
  ACCEPTED: [],
  DECLINED: [],
  EXPIRED: [],
};

export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  SCHEDULED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

type TransitionMap<S extends string> = Record<S, S[]>;

function canTransitionIn<S extends string>(
  map: TransitionMap<S>,
  from: S,
  to: S,
): boolean {
  return map[from]?.includes(to) ?? false;
}

export function canTransitionLead(from: LeadStatus, to: LeadStatus): boolean {
  return canTransitionIn(LEAD_TRANSITIONS, from, to);
}
export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  return canTransitionIn(QUOTE_TRANSITIONS, from, to);
}
export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return canTransitionIn(JOB_TRANSITIONS, from, to);
}

export function nextLeadStatuses(from: LeadStatus): LeadStatus[] {
  return LEAD_TRANSITIONS[from] ?? [];
}
export function nextQuoteStatuses(from: QuoteStatus): QuoteStatus[] {
  return QUOTE_TRANSITIONS[from] ?? [];
}
export function nextJobStatuses(from: JobStatus): JobStatus[] {
  return JOB_TRANSITIONS[from] ?? [];
}

/**
 * Derive an Invoice's status from its total `amount` and the summed `paidAmount`
 * (§21). The *only* function permitted to decide an Invoice status; `recordPayment`
 * calls it and nothing else writes the column.
 */
export function deriveInvoiceStatus(
  amount: Decimal,
  paidAmount: Decimal,
): InvoiceStatus {
  if (paidAmount.lessThanOrEqualTo(0)) return "UNPAID";
  if (paidAmount.greaterThanOrEqualTo(amount)) return "PAID";
  return "PARTIAL";
}

// --- Human-readable labels (shared by badges, menus, activity) --------------

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUOTED: "Quoted",
  WON: "Won",
  LOST: "Lost",
};
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
};
