import "server-only";

import { listPortalTokensForCustomer } from "@/features/customer-portal/repository";

/**
 * STAFF-facing portal-token read (§12.6). Backs the management panel on the
 * internal Customer detail page. Runs under the staff session (the caller has
 * already asserted the role) and returns a **hash-free** view — the bcrypt
 * `tokenHash` never leaves the server, and the plaintext is unrecoverable after
 * issuance, so this list shows only metadata and lifecycle state.
 */

export type PortalTokenView = {
  id: string;
  label: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  /** Derived lifecycle state for the badge: active | expired | revoked. */
  state: "active" | "expired" | "revoked";
};

export async function getPortalTokensForCustomer(
  organizationId: string,
  customerId: string,
): Promise<PortalTokenView[]> {
  const rows = await listPortalTokensForCustomer(organizationId, customerId);
  const now = Date.now();
  return rows.map((t) => ({
    id: t.id,
    label: t.label,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    revokedAt: t.revokedAt,
    lastUsedAt: t.lastUsedAt,
    state: t.revokedAt
      ? "revoked"
      : t.expiresAt && t.expiresAt.getTime() <= now
        ? "expired"
        : "active",
  }));
}
