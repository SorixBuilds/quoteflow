"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";

/**
 * Logout control for the dashboard topbar (§17). Single, obvious action; no
 * confirmation modal. Delegates to the `signOutAction` Server Action, which
 * clears the session cookie and redirects to `/login` (§6.2).
 */
export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => signOutAction())}
    >
      <LogOut />
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
