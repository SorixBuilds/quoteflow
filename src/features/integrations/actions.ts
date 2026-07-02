"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireActiveUser, requireCompanyScope, requireRole } from "@/lib/permissions";
import { toActionError } from "@/lib/errors";
import { logActivity } from "@/features/activity/actions";
import { findIntegrationProvider } from "@/features/integrations/registry";
import {
  setIntegrationStatus,
  upsertIntegration,
} from "@/features/integrations/repository";
import type { ActionResult } from "@/types";

/**
 * Integration connect/disconnect actions (Phase 6B Step 8, §20.6–20.8) —
 * OWNER-only, identical blast-radius justification to Catalog and Automation
 * Rules. The registry is empty in Phase 6 (§5 Non-Goals: zero live
 * integrations), so today these actions' only reachable outcome is the §20.10
 * graceful "Unknown integration" failure — but the lifecycle is complete and
 * tested, so a future adapter is one file plus one registry entry, nothing
 * here changes.
 */

const SETTINGS_PATH = "/settings/integrations";

/** Run a provider's connect flow and upsert the org's connection record. */
export async function connectIntegration(
  providerKey: string,
  authPayload: unknown,
): Promise<ActionResult<{ status: string }>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);

    // Unknown key → typed failure, never a throw (§20.10).
    const provider = findIntegrationProvider(providerKey);
    if (!provider) return { success: false, error: "Unknown integration." };

    const result = await provider.connect(organizationId, authPayload);

    await upsertIntegration(organizationId, session.id, {
      provider: provider.key,
      config: result.config,
    });
    await setIntegrationStatus(organizationId, provider.key, result.status, {
      connectedAt: result.status === "CONNECTED" ? new Date() : null,
    });

    await logActivity({
      organizationId,
      entityType: "ORGANIZATION",
      entityId: organizationId,
      type:
        result.status === "CONNECTED"
          ? "integration_connected"
          : "integration_connect_failed",
      message: provider.displayName,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: { status: result.status } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Run a provider's disconnect flow and mark the record NOT_CONNECTED. */
export async function disconnectIntegration(
  providerKey: string,
): Promise<ActionResult<null>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);

    const provider = findIntegrationProvider(providerKey);
    if (!provider) return { success: false, error: "Unknown integration." };

    await provider.disconnect(organizationId);
    await setIntegrationStatus(organizationId, provider.key, "NOT_CONNECTED", {
      connectedAt: null,
    });

    await logActivity({
      organizationId,
      entityType: "ORGANIZATION",
      entityId: organizationId,
      type: "integration_disconnected",
      message: provider.displayName,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
