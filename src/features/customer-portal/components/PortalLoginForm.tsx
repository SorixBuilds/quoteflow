"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redeemPortalSession } from "@/features/customer-portal/actions";

/**
 * Portal sign-in (§12.7). The access link carries the token in the query string;
 * we prefill it and require an explicit click so redemption — which mints a
 * session cookie and stamps `lastUsedAt` — happens on a POST (a server action),
 * never as a side effect of opening a URL. A bad token shows the same generic
 * message for every failure reason (§12.10).
 */
export function PortalLoginForm({ initialToken }: { initialToken: string }) {
  const [token, setToken] = useState(initialToken);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      // On success the action redirects (throws), so we only get here on failure.
      const result = await redeemPortalSession(token);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="portal-token" className="text-foreground text-sm font-medium">
          Access code
        </label>
        <Input
          id="portal-token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste the code from your link"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
        />
        {error ? (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={isPending || token.trim().length === 0}>
        {isPending ? "Checking…" : "Access your portal"}
      </Button>
    </form>
  );
}
