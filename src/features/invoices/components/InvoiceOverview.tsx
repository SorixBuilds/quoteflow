"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { EmptyState } from "@/components/shared/EmptyState";
import { SelectField } from "@/features/settings/components/fields";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { recordPayment } from "@/features/invoices/actions";
import { PAYMENT_METHODS } from "@/features/invoices/schema";
import type { InvoiceDetail } from "@/features/invoices/queries";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK: "Bank transfer",
  OTHER: "Other",
};

/** Invoice detail Overview tab (Phase 5, §21). */
export function InvoiceOverview({ invoice }: { invoice: InvoiceDetail }) {
  const [amount, setAmount] = useState(invoice.balance);
  const [method, setMethod] = useState<string>("BANK");
  const [reference, setReference] = useState("");
  const [isPending, startTransition] = useTransition();

  const fullyPaid = invoice.status === "PAID";

  function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await recordPayment({
        invoiceId: invoice.id,
        amount,
        method: method as (typeof PAYMENT_METHODS)[number],
        reference,
      });
      if (result.success) {
        showSuccessToast("Payment recorded");
        setReference("");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={invoice.status} variant="invoice" />
            {invoice.overdue ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>
            ) : null}
            <span className="text-muted-foreground text-sm">
              Customer:{" "}
              <Link href={`/customers/${invoice.customerId}`} className="text-primary hover:underline">
                {invoice.customerName}
              </Link>
            </span>
            <span className="text-muted-foreground text-sm">
              Job:{" "}
              <Link href={`/jobs/${invoice.jobId}`} className="text-primary hover:underline">
                View
              </Link>
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Amount" value={invoice.amount} currency={invoice.currency} />
          <Stat label="Paid" value={invoice.paidAmount} currency={invoice.currency} />
          <Stat label="Balance" value={invoice.balance} currency={invoice.currency} emphasize />
        </div>
        <div className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
          <p>Issued: {invoice.issuedAt ? invoice.issuedAt.toLocaleDateString() : "—"}</p>
          <p>Due: {invoice.dueDate ? invoice.dueDate.toLocaleDateString() : "—"}</p>
        </div>
      </div>

      {/* Record payment */}
      {!fullyPaid ? (
        <form onSubmit={submitPayment} className="bg-card space-y-4 rounded-lg border p-6">
          <h3 className="text-sm font-semibold">Record payment</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="pay-amount" className="text-muted-foreground text-xs">
                Amount
              </label>
              <Input id="pay-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <SelectField
              id="pay-method"
              label="Method"
              value={method}
              onChange={setMethod}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: METHOD_LABELS[m] }))}
            />
            <div>
              <label htmlFor="pay-ref" className="text-muted-foreground text-xs">
                Reference (optional)
              </label>
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Recording…" : "Record payment"}
            </Button>
          </div>
        </form>
      ) : null}

      {/* Payment history */}
      <section className="bg-card rounded-lg border p-6">
        <h3 className="mb-3 text-sm font-semibold">Payment history</h3>
        {invoice.payments.length === 0 ? (
          <EmptyState title="No payments yet" />
        ) : (
          <ul className="divide-y">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium">
                    <MoneyDisplay value={p.amount} currency={invoice.currency} /> · {METHOD_LABELS[p.method] ?? p.method}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {p.paidAt.toLocaleDateString()}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
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
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={emphasize ? "text-lg font-semibold" : "text-base font-medium"}>
        <MoneyDisplay value={value} currency={currency} />
      </p>
    </div>
  );
}
