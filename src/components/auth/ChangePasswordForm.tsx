"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/features/auth/actions";
import { changePasswordSchema } from "@/features/auth/schema";

type FieldErrors = Partial<
  Record<"currentPassword" | "newPassword" | "confirmPassword", string>
>;

/**
 * Password change UI (§9.4). Client Component; validates inline with the shared
 * Zod schema, then calls the `changePassword` Server Action, which re-verifies
 * the current password server-side before writing the new hash.
 */
export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const raw = {
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword: String(formData.get("newPassword") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };

    const parsed = changePasswordSchema.safeParse(raw);
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
      const result = await changePassword(parsed.data);
      if (result.success) {
        toast.success("Password updated");
        formRef.current?.reset();
      } else {
        setFormError(result.error);
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
    >
      <PasswordField
        id="currentPassword"
        label="Current password"
        autoComplete="current-password"
        error={fieldErrors.currentPassword}
      />
      <PasswordField
        id="newPassword"
        label="New password"
        autoComplete="new-password"
        hint="At least 10 characters."
        error={fieldErrors.newPassword}
      />
      <PasswordField
        id="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
      />

      <div aria-live="polite" className="min-h-[1.25rem]">
        {formError && <p className="text-destructive text-sm">{formError}</p>}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}

function PasswordField({
  id,
  label,
  error,
  hint,
  autoComplete,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type="password"
        autoComplete={autoComplete}
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
