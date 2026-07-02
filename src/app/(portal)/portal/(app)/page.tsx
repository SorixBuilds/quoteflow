import Link from "next/link";
import { redirect } from "next/navigation";

import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { requirePortalSession } from "@/features/customer-portal/session";
import { getPortalDashboard } from "@/features/customer-portal/queries";

/** Portal home (§12.5) — a read-only roll-up of the customer's own records. */
export default async function PortalHomePage() {
  const session = await requirePortalSession();
  const data = await getPortalDashboard(session);
  if (!data) redirect("/portal/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-foreground text-xl font-semibold">Hi {data.account.name}</h1>
        <p className="text-muted-foreground mt-1 text-sm">Here&apos;s a summary of your account.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Open quotes" value={String(data.openQuotes)} />
        <SummaryCard label="Active jobs" value={String(data.activeJobs)} />
        <SummaryCard
          label="Balance due"
          value={<MoneyDisplay value={data.outstandingBalance} currency={data.account.currency} />}
        />
      </div>

      <Section title="Recent quotes" href="/portal/quotes" empty="No quotes yet.">
        {data.recentQuotes.map((q) => (
          <Row
            key={q.id}
            href={`/portal/quotes/${q.id}`}
            title={`Quote ${q.quoteNumber}`}
            subtitle={q.issueDate ? q.issueDate.toLocaleDateString() : undefined}
            badge={<StatusBadge status={q.status} variant="quote" />}
            amount={<MoneyDisplay value={q.total} currency={data.account.currency} />}
          />
        ))}
      </Section>

      <Section title="Recent invoices" href="/portal/invoices" empty="No invoices yet.">
        {data.recentInvoices.map((inv) => (
          <Row
            key={inv.id}
            href={`/portal/invoices/${inv.id}`}
            title={`Invoice ${inv.invoiceNumber}`}
            subtitle={inv.dueDate ? `Due ${inv.dueDate.toLocaleDateString()}` : undefined}
            badge={<StatusBadge status={inv.status} variant="invoice" />}
            amount={<MoneyDisplay value={inv.balance} currency={data.account.currency} />}
          />
        ))}
      </Section>

      <Section title="Recent jobs" href="/portal/jobs" empty="No jobs yet.">
        {data.recentJobs.map((job) => (
          <Row
            key={job.id}
            href={`/portal/jobs/${job.id}`}
            title={`Job ${job.reference}`}
            subtitle={job.scheduledDate ? job.scheduledDate.toLocaleDateString() : undefined}
            badge={<StatusBadge status={job.status} variant="job" />}
          />
        ))}
      </Section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-foreground mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Section({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href: string;
  empty: string;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        <Link href={href} className="text-primary text-sm hover:underline">
          View all
        </Link>
      </div>
      {hasItems ? (
        <ul className="divide-border border-border divide-y rounded-lg border">{children}</ul>
      ) : (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-4 py-6 text-center text-sm">
          {empty}
        </p>
      )}
    </section>
  );
}

function Row({
  href,
  title,
  subtitle,
  badge,
  amount,
}: {
  href: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  amount?: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="hover:bg-accent/40 flex items-center gap-3 px-4 py-3 transition-colors">
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">{title}</p>
          {subtitle ? <p className="text-muted-foreground truncate text-xs">{subtitle}</p> : null}
        </div>
        {badge}
        {amount ? <span className="text-foreground text-sm font-medium">{amount}</span> : null}
      </Link>
    </li>
  );
}
