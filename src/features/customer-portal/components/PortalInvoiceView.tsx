import { Download } from "lucide-react";

import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import type { AttachmentView } from "@/features/files/queries";
import type { PortalInvoiceDetail } from "@/features/customer-portal/queries";
import { PortalFileList } from "@/features/customer-portal/components/PortalFileList";

/**
 * Customer-facing invoice view (§12.5) — read-only: balance, the running payment
 * history, and PDF downloads (invoice + receipt). No "record a payment" control:
 * online payment is explicitly out of scope until a payment integration exists
 * (§12.13, §5). Balances and totals are server-computed strings.
 */
export function PortalInvoiceView({
  invoice,
  currency,
  attachments,
}: {
  invoice: PortalInvoiceDetail;
  currency: string;
  attachments: AttachmentView[];
}) {
  const hasPayments = invoice.payments.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-semibold">Invoice {invoice.invoiceNumber}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {invoice.issuedAt ? `Issued ${invoice.issuedAt.toLocaleDateString()}` : "Issued —"}
            {invoice.dueDate ? ` · Due ${invoice.dueDate.toLocaleDateString()}` : ""}
          </p>
        </div>
        <StatusBadge status={invoice.status} variant="invoice" />
      </div>

      <div className="border-border grid grid-cols-3 divide-x rounded-lg border text-center">
        <Stat label="Invoice total" value={invoice.amount} currency={currency} />
        <Stat label="Amount paid" value={invoice.paidAmount} currency={currency} />
        <Stat label="Balance due" value={invoice.balance} currency={currency} emphasize />
      </div>

      <section className="space-y-2">
        <h2 className="text-foreground text-sm font-semibold">Payment history</h2>
        {hasPayments ? (
          <div className="border-border overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Method</th>
                  <th className="px-3 py-2 text-left font-medium">Reference</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {invoice.payments.map((p, i) => (
                  <tr key={i}>
                    <td className="text-foreground px-3 py-2">{p.paidAt.toLocaleDateString()}</td>
                    <td className="text-muted-foreground px-3 py-2 capitalize">
                      {p.method.toLowerCase().replace(/_/g, " ")}
                    </td>
                    <td className="text-muted-foreground px-3 py-2">{p.reference ?? "—"}</td>
                    <td className="text-foreground px-3 py-2 text-right">
                      <MoneyDisplay value={p.amount} currency={currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No payments recorded yet" />
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <a
          href={`/portal/documents/invoice/${invoice.id}?download`}
          className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline [&_svg]:size-4"
        >
          <Download />
          Download invoice
        </a>
        {hasPayments ? (
          <a
            href={`/portal/documents/receipt/${invoice.id}?download`}
            className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline [&_svg]:size-4"
          >
            <Download />
            Download receipt
          </a>
        ) : null}
      </div>

      <PortalFileList attachments={attachments} />
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
    <div className="px-3 py-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={emphasize ? "text-foreground mt-1 text-lg font-semibold" : "text-foreground mt-1 text-base"}>
        <MoneyDisplay value={value} currency={currency} />
      </p>
    </div>
  );
}
