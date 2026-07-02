import { redirect } from "next/navigation";

import { requirePortalSession } from "@/features/customer-portal/session";
import { getPortalAccount } from "@/features/customer-portal/queries";
import { PortalNav } from "@/features/customer-portal/components/PortalNav";

/**
 * Authenticated portal shell (§12.5). Guards the whole signed-in subtree —
 * `/portal`, `/portal/quotes`, `/portal/invoices`, `/portal/jobs`,
 * `/portal/account` — with `requirePortalSession()` (redirecting to the portal
 * login, never the staff login). The `(app)` route group keeps the URLs at
 * `/portal/*` while letting `/portal/login` sit outside this nav-bearing layout.
 */
export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePortalSession();
  const account = await getPortalAccount(session);

  // The customer record vanished (e.g. deleted) — the session is moot.
  if (!account) redirect("/portal/login");

  return (
    <div className="min-h-full">
      <PortalNav organizationName={account.organizationName} />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}
