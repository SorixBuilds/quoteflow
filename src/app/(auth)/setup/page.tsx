import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SetupWizardForm } from "@/components/auth/SetupWizardForm";
import { bootstrapOrganization } from "@/features/auth/actions";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Set up QuoteFlow" };

// Bootstrap gating depends on the live Organization count — never cache it.
export const dynamic = "force-dynamic";

/**
 * One-time bootstrap wizard (§12.4). Self-gating: it is permanently inert (404)
 * the moment an Organization exists, regardless of session state. The org-count
 * check lives here, not in middleware, which never touches the database (§11.4).
 */
export default async function SetupPage() {
  if ((await db.organization.count()) > 0) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-foreground text-lg font-semibold">
          Welcome to QuoteFlow
        </h2>
        <p className="text-muted-foreground text-sm">
          Create your organization and owner account to get started. You can add
          your team afterwards.
        </p>
      </div>
      <SetupWizardForm
        action={bootstrapOrganization}
        submitLabel="Create organization"
      />
    </div>
  );
}
