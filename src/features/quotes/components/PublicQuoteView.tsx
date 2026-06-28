"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import {
  acceptQuoteByToken,
  declineQuoteByToken,
  recordQuoteView,
} from "@/features/quotes/public-actions";
import type { PublicQuote } from "@/features/quotes/public";

/**
 * Customer-facing quote view (Phase 5, §16, §39). No session — the page was
 * authorized purely by the HMAC token. On mount it records the first view
 * (SENT → VIEWED); Accept/Decline call the single-purpose token actions. The
 * token grants access to this one quote only.
 */
export function PublicQuoteView({ quote, token }: { quote: PublicQuote; token: string }) {
  const [status, setStatus] = useState(quote.status);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (status === "SENT") {
      void recordQuoteView(token).then(() => setStatus("VIEWED"));
    }
    // Only on first mount for a sent quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decided = status === "ACCEPTED" || status === "DECLINED" || status === "EXPIRED";

  function decide(kind: "accept" | "decline") {
    startTransition(async () => {
      const result =
        kind === "accept" ? await acceptQuoteByToken(token) : await declineQuoteByToken(token);
      if (result.success) {
        setStatus(kind === "accept" ? "ACCEPTED" : "DECLINED");
        showSuccessToast(kind === "accept" ? "Quote accepted — thank you!" : "Quote declined");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {quote.companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={quote.companyLogoUrl} alt={quote.companyName} className="h-10 w-auto" />
          ) : null}
          <div>
            <p className="text-lg font-semibold">{quote.companyName}</p>
            <p className="text-muted-foreground text-sm">
              Quote {quote.quoteNumber}
              {quote.version > 1 ? ` (v${quote.version})` : ""}
            </p>
          </div>
        </div>
        <StatusBadge status={status} variant="quote" />
      </header>

      <p className="text-sm">Prepared for {quote.customerName}</p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Description</th>
              <th className="px-4 py-2.5 text-right font-medium">Qty</th>
              <th className="px-4 py-2.5 text-right font-medium">Unit price</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, i) => (
              <tr key={i} className="border-t">
                <td className="px-4 py-2.5">{item.description}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{item.quantity}</td>
                <td className="px-4 py-2.5 text-right">
                  <MoneyDisplay value={item.unitPrice} currency={quote.currency} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <MoneyDisplay value={item.lineTotal} currency={quote.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto max-w-xs space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <MoneyDisplay value={quote.subtotal} currency={quote.currency} />
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tax</span>
          <MoneyDisplay value={quote.taxAmount} currency={quote.currency} />
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <span>Total</span>
          <MoneyDisplay value={quote.total} currency={quote.currency} />
        </div>
      </div>

      {quote.notes ? <p className="text-muted-foreground text-sm whitespace-pre-wrap">{quote.notes}</p> : null}
      {quote.terms ? (
        <div className="text-muted-foreground text-xs whitespace-pre-wrap">
          <p className="mb-1 font-semibold">Terms</p>
          {quote.terms}
        </div>
      ) : null}

      {decided ? (
        <p className="rounded-md border bg-muted/40 px-4 py-3 text-center text-sm">
          {status === "ACCEPTED"
            ? "You have accepted this quote. We'll be in touch shortly."
            : status === "DECLINED"
              ? "You have declined this quote."
              : "This quote has expired. Please contact us for an updated quote."}
        </p>
      ) : (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={isPending} onClick={() => decide("decline")}>
            Decline
          </Button>
          <Button type="button" variant="cta" disabled={isPending} onClick={() => decide("accept")}>
            {isPending ? "Please wait…" : "Accept quote"}
          </Button>
        </div>
      )}
    </div>
  );
}
