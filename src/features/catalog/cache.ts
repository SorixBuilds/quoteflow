import { cache } from "react";
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import { moneyToString } from "@/lib/money";

/**
 * Catalog caching (Phase 5, §19, §38). Catalog data changes rarely and is read
 * on every Quote Builder load, so it is cached the same way `lib/config` caches
 * `Organization.settings`: a Next.js Data Cache entry tagged
 * `catalog-${organizationId}`, invalidated by every catalog write, with a React
 * `cache()` request-memo on top. This is the *only* business data cached in
 * Phase 5 (§38) — every transactional list/detail read is live.
 *
 * Money/Decimal values are serialized to strings at this boundary so the cached
 * payload is plain-JSON serializable (Decimal instances are not).
 */

export function catalogTag(organizationId: string): string {
  return `catalog-${organizationId}`;
}

export type BuilderService = {
  id: string;
  name: string;
  description: string | null;
  unitType: string;
  price: string;
  categoryId: string | null;
};

export type BuilderTaxRate = {
  id: string;
  name: string;
  rate: string;
  isDefault: boolean;
};

export type BuilderCatalog = {
  services: BuilderService[];
  taxRates: BuilderTaxRate[];
};

async function readBuilderCatalogFromDb(
  organizationId: string,
): Promise<BuilderCatalog> {
  const [services, taxRates] = await Promise.all([
    db.service.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        unitType: true,
        price: true,
        categoryId: true,
      },
    }),
    db.taxRate.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, rate: true, isDefault: true },
    }),
  ]);

  return {
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      unitType: s.unitType,
      price: moneyToString(s.price),
      categoryId: s.categoryId,
    })),
    taxRates: taxRates.map((t) => ({
      id: t.id,
      name: t.name,
      rate: moneyToString(t.rate),
      isDefault: t.isDefault,
    })),
  };
}

/**
 * Read the active catalog (services + tax rates) the Quote Builder needs.
 * Cross-request cached under `catalog-${organizationId}`, request-memoized.
 */
export const getBuilderCatalog = cache((organizationId: string) =>
  unstable_cache(
    () => readBuilderCatalogFromDb(organizationId),
    ["catalog-builder", organizationId],
    { tags: [catalogTag(organizationId)] },
  )(),
);
