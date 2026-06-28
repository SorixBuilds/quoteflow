"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { StatusTransitionMenu, type TransitionOption } from "@/components/shared/StatusTransitionMenu";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { changeQuoteStatus, reviseQuote } from "@/features/quotes/actions";
import { QUOTE_STATUS_LABELS, nextQuoteStatuses } from "@/lib/status";
import type { QuoteDetail } from "@/features/quotes/queries";

const TRANSITION_LABELS: Record<string, string> = {
  SENT: "Send quote",
  ACCEPTED: "Mark accepted",
  DECLINED: "Mark declined",
  EXPIRED: "Mark expired",
};

/** Quote detail Overview tab (Phase 5, §16, §22). */
export function QuoteOverview({
  quote,
  shareUrl,
}: {
  quote: QuoteDetail;
  shareUrl: string | null;
}) {
  const router = useRouter();
  const [isRevising, startRevise] = useTransition();

  // VIEWED is a customer-driven transition only — never offered to staff.
  const transitions: TransitionOption[] = nextQuoteStatuses(quote.status)
    .filter((s) => s !== "VIEWED")
    .map((s) => ({
      value: s,
      label: TRANSITION_LABELS[s] ?? `Mark ${QUOTE_STATUS_LABELS[s]}`,
      variant: s === "DECLINED" || s === "EXPIRED" ? "outline" : "default",
    }));

  const canEdit = quote.status === "DRAFT";
  const canRevise = ["SENT", "VIEWED", "DECLINED", "EXPIRED"].includes(quote.status);

  return (
    <div className="space-y-6">
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={quote.status} variant="quote" />
            <span className="text-muted-foreground text-sm">
              Customer:{" "}
              <Link href={`/customers/${quote.customerId}`} className="text-primary hover:underline">
                {quote.customerName}
              </Link>
            </span>
            {quote.job ? (
              <span className="text-muted-foreground text-sm">
                Job:{" "}
                <Link href={`/jobs/${quote.job.id}`} className="text-primary hover:underline">
                  {quote.job.status}
                </Link>
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            {canEdit ? (
              <Link href={`/quotes/${quote.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Edit
              </Link>
            ) : null}
            {canRevise ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isRevising}
                onClick={() =>
                  startRevise(async () => {
                    const result = await reviseQuote(quote.id);
                    if (result.success) {
                      showSuccessToast("Revision created");
                      router.push(`/quotes/${result.data.id}/edit`);
                    } else {
                      showErrorToast(result.error);
                    }
                  })
                }
              >
                {isRevising ? "Revising…" : "Create revision"}
              </Button>
            ) : null}
          </div>
        </div>

        {quote.revisionChain.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Revisions:</span>
            {quote.revisionChain.map((rev) => (
              <Link
                key={rev.id}
                href={`/quotes/${rev.id}`}
                className={
                  rev.id === quote.id
                    ? "rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
                    : "rounded border px-2 py-0.5 text-xs hover:bg-accent"
                }
              >
                v{rev.version} ({QUOTE_STATUS_LABELS[rev.status]})
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {/* Line items */}
      <div className="bg-card overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Description</th>
              <th className="px-4 py-2.5 text-right font-medium">Qty</th>
              <th className="px-4 py-2.5 text-right font-medium">Unit price</th>
              <th className="px-4 py-2.5 text-left font-medium">Tax</th>
              <th className="px-4 py-2.5 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-2.5">{item.description}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{item.quantity}</td>
                <td className="px-4 py-2.5 text-right">
                  <MoneyDisplay value={item.unitPrice} currency={quote.currency} />
                </td>
                <td className="px-4 py-2.5">{item.taxRateName ?? "Default"}</td>
                <td className="px-4 py-2.5 text-right">
                  <MoneyDisplay value={item.lineTotal} currency={quote.currency} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="bg-card ml-auto max-w-xs space-y-2 rounded-lg border p-6 text-sm">
        <Row label="Subtotal" value={quote.subtotal} currency={quote.currency} />
        {quote.discountType && quote.discountValue ? (
          <Row
            label="Discount"
            value={
              quote.discountType === "PERCENT"
                ? `${quote.discountValue}%`
                : `-${quote.discountValue}`
            }
            currency={quote.currency}
            raw={quote.discountType === "PERCENT"}
          />
        ) : null}
        <Row label="Tax" value={quote.taxAmount} currency={quote.currency} />
        <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
          <span>Total</span>
          <MoneyDisplay value={quote.total} currency={quote.currency} />
        </div>
      </div>

      {/* Share link */}
      {shareUrl ? (
        <div className="bg-card space-y-2 rounded-lg border p-6">
          <h3 className="text-sm font-semibold">Customer share link</h3>
          <p className="text-muted-foreground text-xs">
            Send this read-only link to your customer. Opening it records a view; they can accept or
            decline from it without an account.
          </p>
          <div className="flex gap-2">
            <input readOnly value={shareUrl} className="border-input bg-muted/40 flex-1 rounded-md border px-3 py-2 text-xs" />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(shareUrl);
                showSuccessToast("Link copied");
              }}
            >
              <Copy className="size-4" /> Copy
            </Button>
          </div>
        </div>
      ) : null}

      {quote.notes || quote.terms ? (
        <div className="bg-card grid gap-4 rounded-lg border p-6 text-sm sm:grid-cols-2">
          {quote.notes ? (
            <div>
              <h3 className="mb-1 font-semibold">Notes</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{quote.notes}</p>
            </div>
          ) : null}
          {quote.terms ? (
            <div>
              <h3 className="mb-1 font-semibold">Terms</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{quote.terms}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {transitions.length > 0 ? (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="mb-3 text-sm font-semibold">Update status</h3>
          <StatusTransitionMenu
            variant="quote"
            options={transitions}
            onTransition={(target) => changeQuoteStatus(quote.id, target)}
          />
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  currency,
  raw,
}: {
  label: string;
  value: string;
  currency: string;
  raw?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {raw ? <span>{value}</span> : <MoneyDisplay value={value} currency={currency} />}
    </div>
  );
}
