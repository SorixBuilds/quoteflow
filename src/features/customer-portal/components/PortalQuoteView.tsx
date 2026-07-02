import { Download } from "lucide-react";

import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AttachmentView } from "@/features/files/queries";
import type { PortalQuoteDetail } from "@/features/customer-portal/queries";
import { PortalFileList } from "@/features/customer-portal/components/PortalFileList";
import { QuoteDecisionButtons } from "@/features/customer-portal/components/QuoteDecisionButtons";

/**
 * Customer-facing quote view (§12.5). A read surface over the frozen Quote, with
 * Accept/Decline shown only while the quote is decidable. Every money value is a
 * pre-formatted string from the server (`lib/money`) — the view recomputes
 * nothing. No internal/financial-owner field (assignee, created-by, internal
 * status history) is present.
 */
export function PortalQuoteView({
  quote,
  attachments,
}: {
  quote: PortalQuoteDetail;
  attachments: AttachmentView[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-semibold">Quote {quote.quoteNumber}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {quote.issueDate ? `Issued ${quote.issueDate.toLocaleDateString()}` : "Issued —"}
            {quote.expiryDate ? ` · Valid until ${quote.expiryDate.toLocaleDateString()}` : ""}
          </p>
        </div>
        <StatusBadge status={quote.status} variant="quote" />
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {quote.items.map((item, i) => (
              <tr key={i}>
                <td className="text-foreground px-3 py-2">{item.description}</td>
                <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                  {item.quantity}
                </td>
                <td className="text-muted-foreground px-3 py-2 text-right">
                  <MoneyDisplay value={item.unitPrice} currency={quote.currency} />
                </td>
                <td className="text-foreground px-3 py-2 text-right">
                  <MoneyDisplay value={item.lineTotal} currency={quote.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
        <TotalRow label="Subtotal" value={quote.subtotal} currency={quote.currency} />
        {quote.discountValue ? (
          <TotalRow
            label={quote.discountType === "PERCENT" ? `Discount (${quote.discountValue}%)` : "Discount"}
            value={quote.discountValue}
            currency={quote.currency}
          />
        ) : null}
        <TotalRow label="Tax" value={quote.taxAmount} currency={quote.currency} />
        <div className="border-border text-foreground flex justify-between border-t pt-1.5 text-base font-semibold">
          <span>Total</span>
          <MoneyDisplay value={quote.total} currency={quote.currency} />
        </div>
      </div>

      {quote.notes ? <Note title="Notes" body={quote.notes} /> : null}
      {quote.terms ? <Note title="Terms" body={quote.terms} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        {quote.decidable ? <QuoteDecisionButtons quoteId={quote.id} /> : null}
        <a
          href={`/portal/documents/quote/${quote.id}?download`}
          className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline [&_svg]:size-4"
        >
          <Download />
          Download PDF
        </a>
      </div>

      <PortalFileList attachments={attachments} />
    </div>
  );
}

function TotalRow({ label, value, currency }: { label: string; value: string; currency: string }) {
  return (
    <div className="text-muted-foreground flex justify-between">
      <span>{label}</span>
      <MoneyDisplay value={value} currency={currency} />
    </div>
  );
}

function Note({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-foreground text-sm font-semibold">{title}</h2>
      <p className="text-muted-foreground text-sm whitespace-pre-wrap">{body}</p>
    </div>
  );
}
