import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SetupWizardForm } from "@/components/auth/SetupWizardForm";
import { registerOrganization } from "@/features/auth/actions";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/features/auth/queries";

export const metadata: Metadata = { title: "Register" };

// Depends on the registration flag + session state — resolve per request.
export const dynamic = "force-dynamic";

/**
 * Public self-registration (§12.3). The route is flag-gated: when
 * `ALLOW_PUBLIC_REGISTRATION` is false it 404s here AND is rejected server-side
 * by the action (defense in depth, §19). Reuses the setup wizard form.
 */
export default async function RegisterPage() {
  if (!env.ALLOW_PUBLIC_REGISTRATION) {
    notFound();
  }
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-foreground text-lg font-semibold">
          Create your organization
        </h2>
        <p className="text-muted-foreground text-sm">
          Set up a new QuoteFlow workspace and owner account.
        </p>
      </div>
      <SetupWizardForm
        action={registerOrganization}
        submitLabel="Create account"
      />
    </div>
  );
}
