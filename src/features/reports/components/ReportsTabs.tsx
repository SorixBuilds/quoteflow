"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Reports tab nav (Phase 5, §34). URL-driven (`?tab=`) so each report stays a
 * server component. The revenue tab is only listed for OWNER (the page also
 * enforces it server-side via the OWNER-gated query).
 */
const OPERATIONAL = [
  { key: "turnaround", label: "Quote turnaround" },
  { key: "loss", label: "Loss pattern" },
  { key: "sources", label: "Lead source ROI" },
  // Phase 6B Step 10 (§18.8) — operational additions, OWNER/STAFF.
  { key: "acceptance", label: "Acceptance trend" },
  { key: "utilization", label: "Technician utilization" },
  { key: "clv", label: "Customer value" },
];

// Financial tabs (§18.8) — OWNER only, same gate Revenue & AR already uses.
const FINANCIAL = [
  { key: "revenue", label: "Revenue & AR" },
  { key: "aging", label: "Aging" },
  { key: "profitability", label: "Profitability" },
  { key: "tax", label: "Tax summary" },
];

export function ReportsTabs({ showRevenue }: { showRevenue: boolean }) {
  const params = useSearchParams();
  const active = params.get("tab") ?? "turnaround";
  const tabs = showRevenue ? [...OPERATIONAL, ...FINANCIAL] : OPERATIONAL;

  return (
    <nav aria-label="Reports" className="flex flex-wrap gap-1 border-b pb-px">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={`/reports?tab=${tab.key}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
