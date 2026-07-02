import { getCompanyConfig } from "@/lib/config/service";
import { requireCompanyScope } from "@/lib/permissions";
import type { FeatureFlags, FeatureFlagKey } from "@/lib/config/schema";

/**
 * Feature flag evaluation (Phase 4, §20; centralized framework reaffirmed in
 * Phase 6A). Flags are read through the Configuration Service — there is no
 * separate flag system, and Phase 6 adds none ("No module should implement its
 * own feature flag logic" — authorization brief). Enforcement is two-sided: the
 * Sidebar hides flagged nav UI (via `filterNav`), and a flagged feature's
 * server action calls `requireFeatureFlag()` so the action is rejected even if
 * invoked directly. Hiding a nav item is a UX courtesy, not a security boundary
 * — the flag check belongs in the action too.
 *
 * Step 0 reconciliation: the Phase 6 document refers to flags as `aiEnabled` /
 * `emailProviderEnabled`; the implemented, frozen Phase 4 schema names them
 * `ai` / `portal` / `automation` / `advancedReports` / `invoicing` /
 * `integrations` (`FeatureFlagsSchema`). The schema names are canonical; Phase 6
 * subsystems gate on them (AI on `ai`, Portal on `portal`, etc.). New premium
 * flags are added the same additive way — one key on `FeatureFlagsSchema` plus
 * its default — needing no migration. Provider *selection* (which adapter is
 * live) is env-driven and deliberately separate from these per-org flags (§6.1).
 *
 * Server-only: reads config (which reads Prisma) and the session scope.
 */

/** Whether a flag is enabled for the current tenant. */
export async function isFeatureEnabled(flag: FeatureFlagKey): Promise<boolean> {
  const { organizationId } = await requireCompanyScope();
  const { featureFlags } = await getCompanyConfig(organizationId);
  return featureFlags[flag];
}

/**
 * Client-safe exposure (Phase 6A). Returns the full boolean flag map for the
 * current tenant, suitable for serializing into a Client Component or a
 * `/api`-style flag endpoint. Safe by construction: `FeatureFlags` is booleans
 * only — it contains no secret, credential, or provider configuration — so
 * shipping the whole object to the browser leaks nothing. A client uses it to
 * decide whether to render an optional affordance; the authoritative gate
 * remains `requireFeatureFlag()` in the server action (a client flag is never a
 * security boundary).
 */
export async function getClientFeatureFlags(): Promise<FeatureFlags> {
  const { organizationId } = await requireCompanyScope();
  const { featureFlags } = await getCompanyConfig(organizationId);
  // Return a shallow copy so a caller can't mutate the cached config object.
  return { ...featureFlags };
}

/** Throw if the flag is disabled — the first line of any flag-gated action. */
export async function requireFeatureFlag(flag: FeatureFlagKey): Promise<void> {
  if (!(await isFeatureEnabled(flag))) {
    throw new Error(
      `Feature "${flag}" is not enabled for this organization.`,
    );
  }
}
