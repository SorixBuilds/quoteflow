import { cache } from "react";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";

/**
 * Company Configuration caching wiring (Phase 4, §21).
 *
 * Two layers, both for *data* only — authorization/session reads are never
 * cached (§21/§22 absolute rule) and never pass through here:
 *  - Next.js Data Cache (`unstable_cache`), tagged `company-config-${orgId}`, so
 *    config survives across requests until a write invalidates that tag.
 *  - React `cache()` on top, so multiple server components in one render trigger
 *    a single read.
 *
 * Invalidation lives in the settings action (`revalidateTag(companyConfigTag)`),
 * the one write path, keeping the responsibility in a single place (§24).
 */

/** Next.js Data Cache tag for a tenant's configuration. */
export function companyConfigTag(organizationId: string): string {
  return `company-config-${organizationId}`;
}

async function readSettingsFromDb(organizationId: string): Promise<unknown> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { settings: true },
  });
  return org.settings;
}

function readSettingsCached(organizationId: string): Promise<unknown> {
  return unstable_cache(
    () => readSettingsFromDb(organizationId),
    ["company-config", organizationId],
    { tags: [companyConfigTag(organizationId)] },
  )();
}

/**
 * Read the raw settings JSON — the ONLY place permitted to read
 * `Organization.settings` directly (§5.5). Request-memoized over the tagged
 * cross-request Data Cache.
 */
export const readRawSettings = cache(
  (organizationId: string): Promise<unknown> =>
    readSettingsCached(organizationId),
);
