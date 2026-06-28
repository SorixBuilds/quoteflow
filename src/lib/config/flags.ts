import { getCompanyConfig } from "@/lib/config/service";
import { requireCompanyScope } from "@/lib/permissions";
import type { FeatureFlagKey } from "@/lib/config/schema";

/**
 * Feature flag evaluation (Phase 4, §20). Flags are read through the
 * Configuration Service — there is no separate flag system. Enforcement is
 * two-sided: the Sidebar hides flagged nav UI (via `filterNav`), and a flagged
 * feature's server action calls `requireFeatureFlag()` so the action is rejected
 * even if invoked directly. Hiding a nav item is a UX courtesy, not a security
 * boundary — the flag check belongs in the action too.
 *
 * Server-only: reads config (which reads Prisma) and the session scope.
 */

/** Whether a flag is enabled for the current tenant. */
export async function isFeatureEnabled(flag: FeatureFlagKey): Promise<boolean> {
  const { organizationId } = await requireCompanyScope();
  const { featureFlags } = await getCompanyConfig(organizationId);
  return featureFlags[flag];
}

/** Throw if the flag is disabled — the first line of any flag-gated action. */
export async function requireFeatureFlag(flag: FeatureFlagKey): Promise<void> {
  if (!(await isFeatureEnabled(flag))) {
    throw new Error(
      `Feature "${flag}" is not enabled for this organization.`,
    );
  }
}
