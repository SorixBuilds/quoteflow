import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import {
  getPipelineAnalytics,
  getRevenueForecast,
  getSalesPerformance,
  getTechnicianPerformance,
  type PipelineAnalytics,
  type SalesPerformanceRow,
  type TechnicianPerformanceRow,
} from "@/features/dashboard/insights";
import type { RevenueForecast } from "@/features/dashboard/forecast";

/**
 * The four Step 10 insight widgets (§17.5), rendered server-side below the
 * frozen Phase 5 dashboard. Each widget loads and fails independently
 * (§17.10): a failed query renders that one card's error state, never blanking
 * the rest. To keep failure isolation without constructing JSX inside a
 * try/catch (which React can't catch anyway), each widget awaits its data in a
 * `try`, falls back to a sentinel on error, and renders JSX afterwards.
 * The revenue forecast card renders only for OWNER (§17.8) — its query is
 * OWNER-gated regardless.
 */

const FAILED = Symbol("widget-failed");
type OrFailed<T> = T | typeof FAILED;

async function safely<T>(load: () => Promise<T>): Promise<OrFailed<T>> {
  try {
    return await load();
  } catch {
    return FAILED;
  }
}

function WidgetCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card space-y-3 rounded-lg border p-6">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function WidgetEmpty({ message }: { message: string }) {
  return <p className="text-muted-foreground text-sm">{message}</p>;
}

async function RevenueForecastWidget({ currency }: { currency: string }) {
  const forecast: OrFailed<RevenueForecast> = await safely(getRevenueForecast);

  return (
    <WidgetCard title="Revenue forecast">
      {forecast === FAILED ? (
        <WidgetEmpty message="This insight is unavailable right now." />
      ) : forecast.nextMonth === null ? (
        <WidgetEmpty message="Not enough payment history to project yet." />
      ) : (
        <div className="space-y-2">
          <ul className="space-y-1">
            {forecast.months.map((m) => (
              <li key={m.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{m.label}</span>
                <MoneyDisplay value={m.total} currency={currency} />
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t pt-2 text-sm font-medium">
            <span>Next month (linear trend{forecast.trend ? `, ${forecast.trend}` : ""})</span>
            <MoneyDisplay value={forecast.nextMonth} currency={currency} />
          </div>
        </div>
      )}
    </WidgetCard>
  );
}

async function TechnicianPerformanceWidget() {
  const rows: OrFailed<TechnicianPerformanceRow[]> = await safely(getTechnicianPerformance);

  return (
    <WidgetCard title="Technician performance">
      {rows === FAILED ? (
        <WidgetEmpty message="This insight is unavailable right now." />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="No completed jobs yet." />
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.userId} className="flex items-center justify-between text-sm">
              <span className="truncate">{row.name}</span>
              <span className="text-muted-foreground">
                {row.completedJobs} job{row.completedJobs === 1 ? "" : "s"}
                {row.avgCompletionDays !== null ? ` · avg ${row.avgCompletionDays}d` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

async function SalesPerformanceWidget() {
  const rows: OrFailed<SalesPerformanceRow[]> = await safely(getSalesPerformance);

  return (
    <WidgetCard title="Sales performance">
      {rows === FAILED ? (
        <WidgetEmpty message="This insight is unavailable right now." />
      ) : rows.length === 0 ? (
        <WidgetEmpty message="No quotes sent yet." />
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li key={row.userId} className="flex items-center justify-between text-sm">
              <span className="truncate">{row.name}</span>
              <span className="text-muted-foreground">
                {row.quotesAccepted}/{row.quotesSent} accepted
                {row.conversionRatePercent !== null ? ` · ${row.conversionRatePercent}%` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

async function PipelineAnalyticsWidget() {
  const analytics: OrFailed<PipelineAnalytics> = await safely(getPipelineAnalytics);

  if (analytics === FAILED) {
    return (
      <WidgetCard title="Pipeline analytics">
        <WidgetEmpty message="This insight is unavailable right now." />
      </WidgetCard>
    );
  }

  const hasOpen = analytics.stages.some((s) => s.count > 0);
  return (
    <WidgetCard title="Pipeline analytics">
      <div className="space-y-2">
        {hasOpen ? (
          <ul className="space-y-1">
            {analytics.stages.map((s) => (
              <li key={s.stage} className="flex items-center justify-between text-sm">
                <span className="capitalize">{s.stage.toLowerCase()}</span>
                <span className="text-muted-foreground">
                  {s.count} lead{s.count === 1 ? "" : "s"}
                  {s.avgAgeDays !== null ? ` · avg ${s.avgAgeDays}d in pipeline` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <WidgetEmpty message="No open leads in the pipeline." />
        )}
        <p className="text-muted-foreground border-t pt-2 text-xs">
          Last 90 days: {analytics.wonLast90} won · {analytics.lostLast90} lost
        </p>
      </div>
    </WidgetCard>
  );
}

/** The Step 10 insights band — appended below the frozen Phase 5 widgets. */
export function DashboardInsights({
  isOwner,
  currency,
}: {
  isOwner: boolean;
  currency: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {isOwner ? <RevenueForecastWidget currency={currency} /> : null}
      <SalesPerformanceWidget />
      <TechnicianPerformanceWidget />
      <PipelineAnalyticsWidget />
    </div>
  );
}
