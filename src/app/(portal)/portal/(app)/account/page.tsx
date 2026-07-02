import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requirePortalSession } from "@/features/customer-portal/session";
import { getPortalAccount } from "@/features/customer-portal/queries";
import { PortalContactForm } from "@/features/customer-portal/components/PortalContactForm";

export const metadata: Metadata = { title: "Account" };

export default async function PortalAccountPage() {
  const session = await requirePortalSession();
  const account = await getPortalAccount(session);
  if (!account) redirect("/portal/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground text-xl font-semibold">Your details</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Keep your contact information up to date so {account.organizationName} can reach you.
        </p>
      </div>
      <div className="border-border bg-card rounded-lg border p-5">
        <PortalContactForm account={account} />
      </div>
    </div>
  );
}
