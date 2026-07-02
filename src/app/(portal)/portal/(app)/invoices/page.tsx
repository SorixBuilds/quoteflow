import type { Metadata } from "next";
import Link from "next/link";
import { Receipt } from "lucide-react";

import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { requirePortalSession } from "@/features/customer-portal/session";
import { getPortalAccount, listPortalInvoices } from "@/features/customer-portal/queries";

export const metadata: Metadata = { title: "Invoices" };

export default async function PortalInvoicesPage() {
  const session = await requirePortalSession();
  const [invoices, account] = await Promise.all([
    listPortalInvoices(session),
    getPortalAccount(session),
  ]);
  const currency = account?.currency ?? "USD";

  return (
    <div className="space-y-4">
      <h1 className="text-foreground text-xl font-semibold">Invoices</h1>

      {invoices.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoices yet" description="Your invoices and payment history will appear here." />
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={`/portal/invoices/${invoice.id}`}
                className="hover:bg-accent/40 flex items-center gap-3 px-4 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    Invoice {invoice.invoiceNumber}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {invoice.dueDate ? `Due ${invoice.dueDate.toLocaleDateString()}` : "—"}
                    {" · Balance "}
                    <MoneyDisplay value={invoice.balance} currency={currency} />
                  </p>
                </div>
                <StatusBadge status={invoice.status} variant="invoice" />
                <span className="text-foreground text-sm font-medium">
                  <MoneyDisplay value={invoice.amount} currency={currency} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
