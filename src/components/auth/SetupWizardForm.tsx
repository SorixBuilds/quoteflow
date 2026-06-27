"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setupSchema } from "@/features/auth/schema";
import type { ActionResult } from "@/types";

type FieldErrors = Partial<
  Record<"organizationName" | "ownerName" | "email" | "password", string>
>;

/**
 * Bootstrap setup wizard UI (§12.4) — also reused by the flag-gated public
 * registration page (§12.3), since the inputs are identical. The concrete
 * Server Action is injected so this one component serves both flows (§21
 * rule 9). On success the action issues a session and redirects.
 */
export function SetupWizardForm({
  action,
  submitLabel = "Create organization",
}: {
  action: (input: unknown) => Promise<ActionResult<null>>;
  submitLabel?: string;
}) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const raw = {
      organizationName: String(formData.get("organizationName") ?? ""),
      ownerName: String(formData.get("ownerName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    const parsed = setupSchema.safeParse(raw);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      const result = await action(parsed.data);
      if (result && !result.success) {
        setFormError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field
        id="organizationName"
        label="Organization name"
        autoComplete="organization"
        autoFocus
        error={fieldErrors.organizationName}
      />
      <Field
        id="ownerName"
        label="Your name"
        autoComplete="name"
        error={fieldErrors.ownerName}
      />
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={fieldErrors.email}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 10 characters."
        error={fieldErrors.password}
      />

      <div aria-live="polite" className="min-h-[1.25rem]">
        {formError && <p className="text-destructive text-sm">{formError}</p>}
      </div>

      <Button
        type="submit"
        variant="cta"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? "Creating…" : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  type = "text",
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
      />
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-muted-foreground text-xs">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
