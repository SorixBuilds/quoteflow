"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { CustomerForm } from "@/features/customers/components/CustomerForm";
import { updateCustomer } from "@/features/customers/actions";
import type { CustomerDetail } from "@/features/customers/queries";

/**
 * Customer detail Overview tab (Phase 5, §15). Contact + address, computed
 * lifetime value, and the four related read-only sub-lists (Leads/Quotes/Jobs/
 * Invoices). Edit toggles the shared `CustomerForm` bound to `updateCustomer`.
 */
export function CustomerOverview({
  customer,
  currency,
}: {
  customer: CustomerDetail;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const addr = customer.address as Record<string, string> | null;

  if (editing) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <h2 className="mb-4 text-base font-semibold">Edit customer</h2>
        <CustomerForm
          initial={customer}
          onSubmit={(input) => updateCustomer(customer.id, input)}
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
          submitLabel="Save changes"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Type: </span>
              {customer.type === "BUSINESS" ? "Business" : "Individual"}
            </p>
            <p>
              <span className="text-muted-foreground">Email: </span>
              {customer.email ?? "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Phone: </span>
              {customer.phone ?? "—"}
            </p>
            {addr && Object.keys(addr).length > 0 ? (
              <p>
                <span className="text-muted-foreground">Address: </span>
                {[addr.street, addr.city, addr.state, addr.postal, addr.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Lifetime value</p>
            <p className="text-lg font-semibold">
              <MoneyDisplay value={customer.lifetimeValue} currency={currency} />
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </div>
      </div>

      <RelatedList title="Quotes" empty="No quotes yet">
        {customer.quotes.map((q) => (
          <RelatedRow key={q.id} href={`/quotes/${q.id}`} label={q.quoteNumber}>
            <StatusBadge status={q.status} variant="quote" />
            <MoneyDisplay value={q.total} currency={currency} className="text-sm" />
          </RelatedRow>
        ))}
      </RelatedList>

      <RelatedList title="Jobs" empty="No jobs yet">
        {customer.jobs.map((j) => (
          <RelatedRow
            key={j.id}
            href={`/jobs/${j.id}`}
            label={j.scheduledDate ? j.scheduledDate.toLocaleDateString() : "Unscheduled"}
          >
            <StatusBadge status={j.status} variant="job" />
          </RelatedRow>
        ))}
      </RelatedList>

      <RelatedList title="Invoices" empty="No invoices yet">
        {customer.invoices.map((inv) => (
          <RelatedRow key={inv.id} href={`/invoices/${inv.id}`} label={inv.invoiceNumber}>
            <StatusBadge status={inv.status} variant="invoice" />
            <MoneyDisplay value={inv.amount} currency={currency} className="text-sm" />
          </RelatedRow>
        ))}
      </RelatedList>

      <RelatedList title="Leads" empty="No leads yet">
        {customer.leads.map((l) => (
          <RelatedRow key={l.id} href={`/leads/${l.id}`} label={l.name}>
            <StatusBadge status={l.status} variant="lead" />
          </RelatedRow>
        ))}
      </RelatedList>
    </div>
  );
}

function RelatedList({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="bg-card rounded-lg border p-6">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children.length === 0 ? (
        <EmptyState title={empty} />
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </section>
  );
}

function RelatedRow({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <Link href={href} className="text-primary text-sm font-medium hover:underline">
        {label}
      </Link>
      <div className="flex items-center gap-3">{children}</div>
    </li>
  );
}
