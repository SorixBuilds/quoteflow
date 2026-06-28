import Link from "next/link";
import type { EntityType } from "@prisma/client";

import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { EmptyState } from "@/components/shared/EmptyState";
import { LEAD_STATUS_LABELS } from "@/lib/status";
import type { DashboardData, LeadSourcePerf, PipelineCard } from "@/features/dashboard/queries";
import type { OrgActivityEntry } from "@/features/activity/queries";

/**
 * Dashboard view (Phase 5, §33). Presentational, server-rendered: KPI row,
 * read-only lead pipeline (click-through to detail — drag-and-drop is a
 * documented future enhancement, §42), lead-source performance (lightweight CSS
 * bars, no chart dependency), and the org-wide recent-activity feed.
 */
export function DashboardView({ data }: { data: DashboardData }) {
  const { kpis, currency } = data;
  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="New leads (7d)" value={String(kpis.newLeads7d)} />
        <Kpi
          label="Quote conversion"
          value={kpis.conversionRatePercent === null ? "—" : `${kpis.conversionRatePercent}%`}
        />
        <Kpi
          label="Avg. turnaround"
          value={kpis.avgTurnaroundDays === null ? "—" : `${kpis.avgTurnaroundDays}d`}
        />
        <Kpi label="Pipeline revenue" value={<MoneyDisplay value={kpis.pipelineRevenue} currency={currency} />} />
        <Kpi label="Jobs this week" value={String(kpis.jobsThisWeek)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Lead pipeline</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {(["NEW", "CONTACTED", "QUOTED"] as const).map((status) => (
            <PipelineColumn
              key={status}
              title={LEAD_STATUS_LABELS[status]}
              count={data.pipeline.counts[status]}
              cards={data.pipeline[status]}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="bg-card rounded-lg border p-6">
          <h2 className="mb-4 text-base font-semibold">Lead source performance</h2>
          <LeadSourceBars sources={data.leadSources} />
        </div>
        <div className="bg-card rounded-lg border p-6">
          <h2 className="mb-4 text-base font-semibold">Recent activity</h2>
          <RecentActivity entries={data.recentActivity} />
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function PipelineColumn({
  title,
  count,
  cards,
}: {
  title: string;
  count: number;
  cards: PipelineCard[];
}) {
  return (
    <div className="bg-muted/30 rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-muted-foreground text-xs">{count}</span>
      </div>
      {cards.length === 0 ? (
        <p className="text-muted-foreground px-1 py-4 text-xs">No leads</p>
      ) : (
        <ul className="space-y-2">
          {cards.map((card) => (
            <li key={card.id}>
              <Link href={`/leads/${card.id}`} className="bg-card hover:bg-accent block rounded-md border p-2.5 text-sm">
                <span className="font-medium">{card.name}</span>
                <span className="text-muted-foreground block text-xs">{card.createdAt.toLocaleDateString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {count > cards.length ? (
        <Link href="/leads" className="text-primary mt-2 block px-1 text-xs hover:underline">
          View all {count}
        </Link>
      ) : null}
    </div>
  );
}

function LeadSourceBars({ sources }: { sources: LeadSourcePerf[] }) {
  if (sources.length === 0) {
    return <EmptyState title="No lead sources" description="Add lead sources in the Catalog." />;
  }
  const max = Math.max(1, ...sources.map((s) => s.totalLeads));
  return (
    <ul className="space-y-3">
      {sources.map((s) => (
        <li key={s.id} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{s.name}</span>
            <span className="text-muted-foreground text-xs">
              {s.totalLeads} leads · {s.conversionRatePercent === null ? "—" : `${s.conversionRatePercent}%`} won
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full"
              style={{ width: `${(s.totalLeads / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

const ENTITY_PATHS: Record<EntityType, string | null> = {
  LEAD: "/leads",
  QUOTE: "/quotes",
  JOB: "/jobs",
  CUSTOMER: "/customers",
  INVOICE: "/invoices",
  ORGANIZATION: null,
};

const ACTIVITY_LABELS: Record<string, string> = {
  created: "Created",
  status_changed: "Status changed",
  assigned: "Assigned",
  note_added: "Note added",
  quote_revised: "Quote revised",
  quote_sent: "Quote sent",
  quote_viewed: "Quote viewed",
  quote_accepted: "Quote accepted",
  quote_declined: "Quote declined",
  job_scheduled: "Job scheduled",
  job_assigned: "Job assigned",
  job_completed: "Job completed",
  job_cancelled: "Job cancelled",
  invoice_created: "Invoice created",
  payment_recorded: "Payment recorded",
};

function RecentActivity({ entries }: { entries: OrgActivityEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState title="No activity yet" description="Actions across your business will appear here." />;
  }
  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const base = ENTITY_PATHS[entry.entityType];
        const href = base ? `${base}/${entry.entityId}` : null;
        const label = ACTIVITY_LABELS[entry.type] ?? entry.type;
        const content = (
          <>
            <span className="text-foreground font-medium">{label}</span>
            {entry.message ? <span className="text-muted-foreground"> — {entry.message}</span> : null}
            <span className="text-muted-foreground block text-xs">
              {entry.actorName} · {entry.createdAt.toLocaleString()}
            </span>
          </>
        );
        return (
          <li key={entry.id} className="text-sm">
            {href ? (
              <Link href={href} className="hover:bg-accent -mx-2 block rounded px-2 py-1">
                {content}
              </Link>
            ) : (
              <div className="px-2 py-1">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
