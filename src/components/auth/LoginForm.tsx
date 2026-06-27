"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/features/auth/actions";
import { loginSchema } from "@/features/auth/schema";

type LoginNotice = "expired" | "deactivated" | null;

const NOTICE_COPY: Record<Exclude<LoginNotice, null>, string> = {
  expired: "Your session expired. Please sign in again.",
  deactivated: "Your account is no longer active. Contact your administrator.",
};

/**
 * Login UI (§17). Client Component: validates inline with the shared Zod schema
 * before the round trip, then delegates to the `signInAction` Server Action,
 * which performs the actual authentication (§21 rule 1). The error region is
 * inline and non-disappearing.
 */
export function LoginForm({
  callbackUrl = "/dashboard",
  notice = null,
}: {
  callbackUrl?: string;
  notice?: LoginNotice;
}) {
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const raw = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      const errors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" && !errors.email) errors.email = issue.message;
        if (key === "password" && !errors.password)
          errors.password = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      const result = await signInAction({ ...parsed.data, callbackUrl });
      // On success the action redirects; we only get here on failure.
      if (result && !result.success) {
        setFormError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {notice && (
        <p
          role="status"
          className="bg-muted text-muted-foreground rounded-md px-3 py-2 text-sm"
        >
          {NOTICE_COPY[notice]}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        {fieldErrors.email && (
          <p id="email-error" className="text-destructive text-xs">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
        />
        {fieldErrors.password && (
          <p id="password-error" className="text-destructive text-xs">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <div aria-live="polite" className="min-h-[1.25rem]">
        {formError && <p className="text-destructive text-sm">{formError}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-muted-foreground text-center text-xs">
        Forgot your password? Password resets are handled by your administrator.
      </p>
    </form>
  );
}
