import { cn } from "@/lib/utils";
import {
  INVOICE_STATUS_LABELS,
  JOB_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
} from "@/lib/status";

/**
 * Shared status pill (Phase 5, §12, §13). One component renders every status
 * across Lead/Quote/Job/Invoice as a colored badge — a raw status string is
 * never printed anywhere in the app. Status values are unique across the four
 * enums, so a single color map is unambiguous; labels come from the shared
 * `lib/status` label maps.
 *
 * Presentational and isomorphic (server or client).
 */

export type StatusVariant = "lead" | "quote" | "job" | "invoice";

const COLORS: Record<string, string> = {
  // Lead
  NEW: "bg-slate-100 text-slate-700",
  CONTACTED: "bg-blue-100 text-blue-700",
  QUOTED: "bg-violet-100 text-violet-700",
  WON: "bg-green-100 text-green-700",
  LOST: "bg-red-100 text-red-700",
  // Quote
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-indigo-100 text-indigo-700",
  ACCEPTED: "bg-green-100 text-green-700",
  DECLINED: "bg-red-100 text-red-700",
  EXPIRED: "bg-amber-100 text-amber-800",
  // Job
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  // Invoice
  UNPAID: "bg-red-100 text-red-700",
  PARTIAL: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-700",
};

const LABELS_BY_VARIANT: Record<StatusVariant, Record<string, string>> = {
  lead: LEAD_STATUS_LABELS,
  quote: QUOTE_STATUS_LABELS,
  job: JOB_STATUS_LABELS,
  invoice: INVOICE_STATUS_LABELS,
};

function humanize(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusBadge({
  status,
  variant,
  className,
}: {
  status: string;
  variant?: StatusVariant;
  className?: string;
}) {
  const label =
    (variant && LABELS_BY_VARIANT[variant][status]) ?? humanize(status);
  const color = COLORS[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        color,
        className,
      )}
    >
      {label}
    </span>
  );
}
