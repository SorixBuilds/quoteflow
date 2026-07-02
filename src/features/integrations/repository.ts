import type { Integration, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type {
  ConnectIntegrationInput,
  IntegrationStatus,
} from "@/features/integrations/validation";

/**
 * Integration repository (§7.2.6, §20) — pure persistence for third-party
 * connection records. Organization-scoped, with the schema's `@@unique
 * ([organizationId, provider])` guaranteeing one connection row per provider per
 * tenant. `config` stores NON-SECRET metadata only (§20.9); credentials never
 * pass through here. No live adapter is built in this phase — this is the
 * connection-record persistence the registry (Phase 6A `registry.ts`) pairs with.
 */

/**
 * Create or update the single connection row for a provider, org-scoped. Uses the
 * `(organizationId, provider)` unique constraint so a re-connect updates in place
 * rather than duplicating.
 */
export function upsertIntegration(
  organizationId: string,
  createdById: string,
  input: ConnectIntegrationInput,
): Promise<Integration> {
  const config = input.config as Prisma.InputJsonValue | undefined;
  return db.integration.upsert({
    where: { organizationId_provider: { organizationId, provider: input.provider } },
    create: {
      organizationId,
      createdById,
      provider: input.provider,
      config,
    },
    update: {
      config,
    },
  });
}

/** All integrations for an organization. */
export function listIntegrations(organizationId: string): Promise<Integration[]> {
  return db.integration.findMany({
    where: { organizationId },
    orderBy: { provider: "asc" },
  });
}

/** The connection row for one provider, org-scoped (or null). */
export function getIntegration(
  organizationId: string,
  provider: string,
): Promise<Integration | null> {
  return db.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider } },
  });
}

/** Update connection status (and optional sync/connect timestamps), org-scoped. */
export function setIntegrationStatus(
  organizationId: string,
  provider: string,
  status: IntegrationStatus,
  timestamps: { connectedAt?: Date | null; lastSyncAt?: Date | null } = {},
): Promise<Prisma.BatchPayload> {
  return db.integration.updateMany({
    where: { organizationId, provider },
    data: {
      status,
      connectedAt: timestamps.connectedAt,
      lastSyncAt: timestamps.lastSyncAt,
    },
  });
}

/** Remove a connection row, org-scoped. */
export async function deleteIntegration(
  organizationId: string,
  provider: string,
): Promise<boolean> {
  const result = await db.integration.deleteMany({
    where: { organizationId, provider },
  });
  return result.count > 0;
}
