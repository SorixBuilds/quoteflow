"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { acceptQuoteFromPortal, declineQuoteFromPortal } from "@/features/customer-portal/actions";

/**
 * Customer Accept / Decline controls (§12.5, §12.8). These call the portal accept/
 * decline actions, which reuse the same server-authoritative `acceptQuote()`/
 * `declineQuote()` transitions the staff app uses — the customer never computes
 * anything. Shown only while the quote is still decidable (the server gates this
 * too, so a stale click returns a friendly "changed by someone else" message).
 */
export function QuoteDecisionButtons({ quoteId }: { quoteId: string }) {
  const [isPending, startTransition] = useTransition();

  function decide(action: typeof acceptQuoteFromPortal, successMessage: string) {
    startTransition(async () => {
      const result = await action(quoteId);
      if (result.success) {
        showSuccessToast(successMessage);
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="cta"
        disabled={isPending}
        onClick={() => decide(acceptQuoteFromPortal, "Quote accepted — thank you!")}
      >
        Accept quote
      </Button>
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() => decide(declineQuoteFromPortal, "Quote declined.")}
      >
        Decline
      </Button>
    </div>
  );
}
