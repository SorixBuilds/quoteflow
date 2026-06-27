import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/permissions";
import { logActivity } from "@/features/activity/actions";
import { readRawSettings } from "@/lib/config/cache";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";
import { deepMerge } from "@/lib/config/merge";
import { migrateToLatest } from "@/lib/config/migrations";
import {
  CompanyConfigSchema,
  type CompanyConfig,
  type CompanyConfigPatch,
} from "@/lib/config/schema";

/**
 * Company Configuration Service (Phase 4, §5.5) — the sole reader/writer of the
 * tenant's `Organization.settings` JSON. Every other module goes through these
 * two functions; no module reads or writes `settings` directly (enforced by a
 * grep-based PR review check, §5.5).
 *
 * Server-only: imports Prisma and the permission helpers.
 */

/**
 * Read a tenant's current, validated, fully-defaulted configuration.
 *
 * 1. Read raw settings (request-memoized; the only direct `settings` read).
 * 2. Migrate the stored shape up to the current version.
 * 3. Validate `deepMerge(defaults, migrated)` — a partial/legacy blob never
 *    crashes because every missing key falls back to a default.
 */
export async function getCompanyConfig(
  organizationId: string,
): Promise<CompanyConfig> {
  const raw = await readRawSettings(organizationId);
  const migrated = migrateToLatest(raw);
  return CompanyConfigSchema.parse(deepMerge(DEFAULT_COMPANY_CONFIG, migrated));
}

/**
 * Write a section-aware partial update to a tenant's configuration.
 *
 * OWNER-gated *inside the service itself* (defense in depth, §5.5) — not only at
 * the calling action — so no future direct caller can bypass the rule. The full
 * merged document is re-validated before any write, so a malformed partial can
 * never reach the database (§22 configuration corruption).
 */
export async function updateCompanyConfig(
  organizationId: string,
  partial: CompanyConfigPatch,
): Promise<CompanyConfig> {
  const session = await requireRole(["OWNER"]);

  // Tenant safety: an OWNER may only write their own organization's config.
  if (session.organizationId !== organizationId) {
    throw new Error("Cannot update configuration for another organization.");
  }

  const current = await getCompanyConfig(organizationId);
  // Section-aware deep merge: a patch touches only the keys it names; every
  // other key in that section, and every other section, is preserved.
  const merged = CompanyConfigSchema.parse(deepMerge(current, partial));

  await db.organization.update({
    where: { id: organizationId },
    // CompanyConfig is a validated, JSON-serializable document; Prisma's Json
    // input type can't infer that from our richer TS type, so we assert it.
    data: { settings: merged as unknown as Prisma.InputJsonObject },
  });

  await logActivity({
    organizationId,
    entityType: "ORGANIZATION",
    entityId: organizationId,
    type: "settings_updated",
    createdById: session.id,
  });

  return merged;
}
