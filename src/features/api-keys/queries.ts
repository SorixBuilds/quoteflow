import "server-only";

import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { listApiKeys } from "@/features/api-keys/repository";

/**
 * API-key read path (Phase 6B Step 7, §21.5) — OWNER-only, company-scoped.
 * Only display-safe fields leave this module: the hash never leaves the
 * repository, and the full key exists nowhere to read back (§21.9).
 */

export type ApiKeyListItem = {
  id: string;
  name: string;
  /** First characters of the key — the only identifying fragment ever shown. */
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
};

/** Every key for the org (management list), newest first. */
export async function listKeysForOrg(): Promise<ApiKeyListItem[]> {
  const session = await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope(session);
  const keys = await listApiKeys(organizationId);

  return keys.map((key) => ({
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
    isActive: key.isActive,
    lastUsedAt: key.lastUsedAt,
    createdAt: key.createdAt,
    revokedAt: key.revokedAt,
  }));
}
