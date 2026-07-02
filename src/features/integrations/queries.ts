import "server-only";

import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { integrationRegistry } from "@/features/integrations/registry";
import { listIntegrations } from "@/features/integrations/repository";

/**
 * Integration read path (Phase 6B Step 8, §20.5) — OWNER-only. The Settings →
 * Integrations screen lists every REGISTERED provider (what's possible), each
 * merged with its org connection row (what's active) — per §20.5, showing the
 * framework's readiness, not just live connections. With the Phase 6 registry
 * empty (§5), the list is empty by design.
 */

export type IntegrationView = {
  key: string;
  displayName: string;
  status: string;
  connectedAt: Date | null;
};

/** Registered providers merged with the org's connection records. */
export async function listIntegrationsForOrg(): Promise<IntegrationView[]> {
  const session = await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope(session);
  const rows = await listIntegrations(organizationId);
  const rowByProvider = new Map(rows.map((row) => [row.provider, row]));

  return integrationRegistry.map((provider) => {
    const row = rowByProvider.get(provider.key);
    return {
      key: provider.key,
      displayName: provider.displayName,
      status: row?.status ?? "NOT_CONNECTED",
      connectedAt: row?.connectedAt ?? null,
    };
  });
}
