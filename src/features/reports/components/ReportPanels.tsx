import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { EmptyState } from "@/components/shared/EmptyState";
import type {
  LeadSourceRoiRow,
  LossPatternRow,
  RevenueReport,
  TurnaroundReport,
} from "@/features/reports/queries";

/** Presentational report panels (Phase 5, §34). */

export function TurnaroundPanel({ report }: { report: TurnaroundReport }) {
  return (
    <div className="bg-card rounded-lg border p-6">
      <h2 className="text-base font-semibold">Quote turnaround time</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Average days from a quote being sent to being accepted.
      </p>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold">
          {report.avgDays === null ? "—" : report.avgDays}
        </span>
        {report.avgDays !== null ? <span className="text-muted-foreground">days avg</span> : null}
      </div>
      <p className="text-muted-foreground mt-1 text-xs">Across {report.count} accepted quote(s).</p>
    </div>
  );
}

export function LossPatternPanel({ rows }: { rows: LossPatternRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No lost leads yet" description="Loss reasons will be summarized here." />;
  }
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="bg-card rounded-lg border p-6">
      <h2 className="mb-4 text-base font-semibold">Loss pattern</h2>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.reason} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{row.reason}</span>
              <span className="text-muted-foreground">{row.count}</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div className="bg-destructive h-full rounded-full" style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LeadSourceRoiPanel({
  rows,
  currency,
}: {
  rows: LeadSourceRoiRow[];
  currency: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No lead sources" description="Add lead sources in the Catalog." />;
  }
  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">Source</th>
            <th className="px-4 py-2.5 text-right font-medium">Leads</th>
            <th className="px-4 py-2.5 text-right font-medium">Won</th>
            <th className="px-4 py-2.5 text-right font-medium">Conversion</th>
            <th className="px-4 py-2.5 text-right font-medium">Est. cost</th>
            <th className="px-4 py-2.5 text-right font-medium">Accepted revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="px-4 py-2.5">{row.name}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{row.totalLeads}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{row.wonLeads}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {row.conversionRatePercent === null ? "—" : `${row.conversionRatePercent}%`}
              </td>
              <td className="px-4 py-2.5 text-right">
                {row.estimatedCost ? <MoneyDisplay value={row.estimatedCost} currency={currency} /> : "—"}
              </td>
              <td className="px-4 py-2.5 text-right">
                <MoneyDisplay value={row.acceptedRevenue} currency={currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RevenuePanel({
  report,
  currency,
}: {
  report: RevenueReport;
  currency: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <RevenueStat label="Total invoiced" value={report.totalInvoiced} currency={currency} />
      <RevenueStat label="Total collected" value={report.totalCollected} currency={currency} />
      <RevenueStat label="Outstanding" value={report.outstanding} currency={currency} />
      <RevenueStat label="Overdue outstanding" value={report.overdueOutstanding} currency={currency} emphasize />
    </div>
  );
}

function RevenueStat({
  label,
  value,
  currency,
  emphasize,
}: {
  label: string;
  value: string;
  currency: string;
  emphasize?: boolean;
}) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={emphasize ? "mt-1 text-2xl font-semibold text-red-700" : "mt-1 text-2xl font-semibold"}>
        <MoneyDisplay value={value} currency={currency} />
      </p>
    </div>
  );
}
