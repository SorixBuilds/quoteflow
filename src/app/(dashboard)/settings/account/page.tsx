import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { requireSession } from "@/features/auth/queries";

export const metadata: Metadata = { title: "Account" };

/** Account settings — password self-change (§9.4). Any authenticated user. */
export default async function AccountSettingsPage() {
  await requireSession();

  return (
    <div className="max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          Account
        </h1>
        <p className="text-muted-foreground text-sm">
          Change your password. You&apos;ll need your current password to
          confirm.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
