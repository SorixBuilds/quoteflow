import { KeyRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { getPortalTokensForCustomer } from "@/features/customer-portal/staff-queries";
import { IssuePortalTokenForm } from "@/features/customer-portal/components/IssuePortalTokenForm";
import { RevokePortalTokenButton } from "@/features/customer-portal/components/RevokePortalTokenButton";

/**
 * Staff-side Customer Portal management (§12.6) — rendered on the internal
 * Customer detail page. Lists the customer's issued portal links with their
 * lifecycle state, lets staff mint a new one-time link, and revoke any active
 * link. Runs under the staff session (the page asserts OWNER/STAFF); the
 * `tokenHash` never reaches this component (`getPortalTokensForCustomer` strips it).
 */

const STATE_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  expired: "bg-amber-100 text-amber-800",
  revoked: "bg-slate-100 text-slate-600",
};

export async function PortalAccessPanel({
  organizationId,
  customerId,
}: {
  organizationId: string;
  customerId: string;
}) {
  const tokens = await getPortalTokensForCustomer(organizationId, customerId);

  return (
    <section className="border-border bg-card space-y-4 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <KeyRound className="text-muted-foreground size-4" />
        <h2 className="text-foreground text-sm font-semibold">Customer Portal access</h2>
      </div>
      <p className="text-muted-foreground text-sm">
        Create a secure link the customer can use to view their quotes, invoices, and jobs — no
        account required. Send it to them directly; it&apos;s shown only once.
      </p>

      <IssuePortalTokenForm customerId={customerId} />

      {tokens.length === 0 ? (
        <EmptyState title="No portal links yet" />
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-foreground truncate text-sm font-medium">
                  {token.label ?? "Portal link"}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                  Created {token.createdAt.toLocaleDateString()}
                  {token.expiresAt ? ` · Expires ${token.expiresAt.toLocaleDateString()}` : ""}
                  {token.lastUsedAt ? ` · Last used ${token.lastUsedAt.toLocaleDateString()}` : " · Never used"}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  STATE_STYLES[token.state],
                )}
              >
                {token.state}
              </span>
              {token.state === "active" ? <RevokePortalTokenButton tokenId={token.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
