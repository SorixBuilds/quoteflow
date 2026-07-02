"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { retryEmail } from "@/features/email/actions";

/**
 * Resend control for a FAILED email row (§11.10, §13). Re-renders fresh from the
 * related entity on the server and re-enters the send flow on the same EmailLog
 * row; surfaces the outcome as the standard toast.
 */
export function ResendEmailButton({ emailLogId }: { emailLogId: string }) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await retryEmail(emailLogId);
      if (result.success) {
        showSuccessToast(
          result.data.status === "FAILED"
            ? "Retried — still failing. Check the address."
            : "Email resent.",
        );
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={onClick}>
      {isPending ? "Resending…" : "Resend"}
    </Button>
  );
}
