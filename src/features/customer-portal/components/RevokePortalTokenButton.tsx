"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { revokePortalToken } from "@/features/customer-portal/staff-actions";

/**
 * Staff control to revoke a portal link (§12.9 — tokens are revocable). Idempotent
 * on the server; surfaces success/failure as the standard toast.
 */
export function RevokePortalTokenButton({ tokenId }: { tokenId: string }) {
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await revokePortalToken(tokenId);
      if (result.success) {
        showSuccessToast("Link revoked.");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={onClick}>
      Revoke
    </Button>
  );
}
