import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { requirePortalSession } from "@/features/customer-portal/session";
import { getPortalAccount, listPortalQuotes } from "@/features/customer-portal/queries";

export const metadata: Metadata = { title: "Quotes" };

export default async function PortalQuotesPage() {
  const session = await requirePortalSession();
  const [quotes, account] = await Promise.all([
    listPortalQuotes(session),
    getPortalAccount(session),
  ]);
  const currency = account?.currency ?? "USD";

  return (
    <div className="space-y-4">
      <h1 className="text-foreground text-xl font-semibold">Quotes</h1>

      {quotes.length === 0 ? (
        <EmptyState icon={FileText} title="No quotes yet" description="Quotes the business sends you will appear here." />
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link
                href={`/portal/quotes/${quote.id}`}
                className="hover:bg-accent/40 flex items-center gap-3 px-4 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">Quote {quote.quoteNumber}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {quote.issueDate ? quote.issueDate.toLocaleDateString() : "—"}
                    {quote.expiryDate ? ` · Valid until ${quote.expiryDate.toLocaleDateString()}` : ""}
                  </p>
                </div>
                <StatusBadge status={quote.status} variant="quote" />
                <span className="text-foreground text-sm font-medium">
                  <MoneyDisplay value={quote.total} currency={currency} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
