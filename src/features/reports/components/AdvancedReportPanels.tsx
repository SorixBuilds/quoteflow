import { EmptyState } from "@/components/shared/EmptyState";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { AGING_BUCKETS, type AgingBuckets } from "@/features/reports/aging";
import type {
  AcceptanceTrendRow,
  CustomerLifetimeValueRow,
  ProfitabilityRow,
  TaxSummaryRow,
} from "@/features/reports/queries";
import type { TechnicianPerformanceRow } from "@/features/dashboard/insights";

/**
 * Step 10 report panels (§18.5) — new tabs inside the existing Reports shell,
 * matching the Phase 5 panel conventions exactly (bordered table, tabular
 * numerals, explicit "No data for this period" empties per §18.10).
 */

function ReportTable({
  headers,
  children,
}: {
  headers: { label: string; align?: "left" | "right" }[];
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th
                key={h.label}
                className={`px-4 py-2.5 font-medium ${h.align === "right" ? "text-right" : "text-left"}`}
              >
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AcceptanceTrendPanel({ rows }: { rows: AcceptanceTrendRow[] }) {
  if (rows.every((r) => r.sent === 0 && r.accepted === 0)) {
    return <EmptyState title="No data for this period" description="Send a quote to start the trend." />;
  }
  return (
    <ReportTable
      headers={[
        { label: "Month" },
        { label: "Sent", align: "right" },
        { label: "Accepted", align: "right" },
        { label: "Acceptance rate", align: "right" },
      ]}
    >
      {rows.map((row) => (
        <tr key={row.monthLabel} className="border-t">
          <td className="px-4 py-2.5">{row.monthLabel}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{row.sent}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{row.accepted}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">
            {row.acceptanceRatePercent === null ? "—" : `${row.acceptanceRatePercent}%`}
          </td>
        </tr>
      ))}
    </ReportTable>
  );
}

export function TechnicianUtilizationPanel({ rows }: { rows: TechnicianPerformanceRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No data for this period" description="Completed jobs will be summarized per technician." />;
  }
  return (
    <ReportTable
      headers={[
        { label: "Technician" },
        { label: "Completed jobs", align: "right" },
        { label: "Avg completion", align: "right" },
      ]}
    >
      {rows.map((row) => (
        <tr key={row.userId} className="border-t">
          <td className="px-4 py-2.5">{row.name}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{row.completedJobs}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">
            {row.avgCompletionDays === null ? "—" : `${row.avgCompletionDays} days`}
          </td>
        </tr>
      ))}
    </ReportTable>
  );
}

export function CustomerLifetimeValuePanel({
  rows,
  currency,
}: {
  rows: CustomerLifetimeValueRow[];
  currency: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No data for this period" description="Invoice a customer to build lifetime value." />;
  }
  return (
    <ReportTable
      headers={[
        { label: "Customer" },
        { label: "Invoices", align: "right" },
        { label: "Invoiced", align: "right" },
        { label: "Collected", align: "right" },
      ]}
    >
      {rows.map((row) => (
        <tr key={row.customerId} className="border-t">
          <td className="px-4 py-2.5">{row.name}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{row.invoices}</td>
          <td className="px-4 py-2.5 text-right">
            <MoneyDisplay value={row.totalInvoiced} currency={currency} />
          </td>
          <td className="px-4 py-2.5 text-right">
            <MoneyDisplay value={row.totalCollected} currency={currency} />
          </td>
        </tr>
      ))}
    </ReportTable>
  );
}

const AGING_LABELS: Record<(typeof AGING_BUCKETS)[number], string> = {
  current: "Not yet due",
  "0-30": "0–30 days overdue",
  "31-60": "31–60 days overdue",
  "61-90": "61–90 days overdue",
  "90+": "Over 90 days overdue",
};

export function AgingPanel({ buckets, currency }: { buckets: AgingBuckets; currency: string }) {
  if (AGING_BUCKETS.every((key) => buckets[key].count === 0)) {
    return <EmptyState title="Nothing outstanding" description="Every invoice is fully paid." />;
  }
  return (
    <ReportTable
      headers={[
        { label: "Age" },
        { label: "Invoices", align: "right" },
        { label: "Outstanding", align: "right" },
      ]}
    >
      {AGING_BUCKETS.map((key) => (
        <tr key={key} className="border-t">
          <td className="px-4 py-2.5">{AGING_LABELS[key]}</td>
          <td className="px-4 py-2.5 text-right tabular-nums">{buckets[key].count}</td>
          <td className="px-4 py-2.5 text-right">
            <MoneyDisplay value={buckets[key].total} currency={currency} />
          </td>
        </tr>
      ))}
    </ReportTable>
  );
}

export function ProfitabilityPanel({
  rows,
  currency,
}: {
  rows: ProfitabilityRow[];
  currency: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No data for this period" description="Add lead sources in the Catalog to attribute revenue." />;
  }
  return (
    <div className="space-y-2">
      <ReportTable
        headers={[
          { label: "Lead source" },
          { label: "Leads", align: "right" },
          { label: "Acquisition cost", align: "right" },
          { label: "Invoiced revenue", align: "right" },
          { label: "Net", align: "right" },
        ]}
      >
        {rows.map((row) => (
          <tr key={row.sourceId} className="border-t">
            <td className="px-4 py-2.5">{row.sourceName}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{row.leads}</td>
            <td className="px-4 py-2.5 text-right">
              {row.acquisitionCost ? (
                <MoneyDisplay value={row.acquisitionCost} currency={currency} />
              ) : (
                "—"
              )}
            </td>
            <td className="px-4 py-2.5 text-right">
              <MoneyDisplay value={row.invoicedRevenue} currency={currency} />
            </td>
            <td className="px-4 py-2.5 text-right">
              {row.net ? <MoneyDisplay value={row.net} currency={currency} /> : "—"}
            </td>
          </tr>
        ))}
      </ReportTable>
      <p className="text-muted-foreground text-xs">
        V1 profitability is revenue against lead-acquisition cost (cost per lead × leads) —
        the only cost figure captured today. It is not a job-costing P&amp;L.
      </p>
    </div>
  );
}

export function TaxSummaryPanel({
  rows,
  currency,
}: {
  rows: TaxSummaryRow[];
  currency: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No data for this period" description="Accepted quotes' line items will be summarized by tax rate." />;
  }
  return (
    <div className="space-y-2">
      <ReportTable
        headers={[
          { label: "Tax rate" },
          { label: "Rate", align: "right" },
          { label: "Taxable base", align: "right" },
          { label: "Tax (est.)", align: "right" },
        ]}
      >
        {rows.map((row) => (
          <tr key={row.taxRateId ?? "none"} className="border-t">
            <td className="px-4 py-2.5">{row.taxRateName}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">
              {row.ratePercent === null ? "—" : `${row.ratePercent}%`}
            </td>
            <td className="px-4 py-2.5 text-right">
              <MoneyDisplay value={row.taxableBase} currency={currency} />
            </td>
            <td className="px-4 py-2.5 text-right">
              <MoneyDisplay value={row.taxCollectedEstimate} currency={currency} />
            </td>
          </tr>
        ))}
      </ReportTable>
      <p className="text-muted-foreground text-xs">
        A reference over accepted quotes&apos; line items — not a tax-filing or compliance tool.
      </p>
    </div>
  );
}
