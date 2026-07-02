"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireActiveUser, requireRole } from "@/lib/permissions";
import { toActionError } from "@/lib/errors";
import { logActivity } from "@/features/activity/actions";
import {
  createWebhook,
  deleteWebhook,
  getWebhookById,
  setWebhookActive,
} from "@/features/webhooks/repository";
import {
  createWebhookSchema,
  type CreateWebhookInput,
} from "@/features/webhooks/validation";
import type { ActionResult } from "@/types";

/**
 * Webhook subscription management (Phase 6B Step 8, §21.5) — OWNER-only, the
 * same blast-radius justification as API keys and automation rules. The HMAC
 * signing `secret` is returned exactly once from {@link createWebhookAction}
 * (§21.9/§22.2 — "shown once, never re-displayed"); every later read path
 * omits it.
 */

const SETTINGS_PATH = "/settings/integrations";

export type CreatedWebhookResult = {
  id: string;
  url: string;
  subscribedEvents: string[];
  /** HMAC signing secret — shown once, then unrecoverable. */
  secret: string;
};

/** Create a webhook subscription; returns the one-time signing secret. */
export async function createWebhookAction(
  input: CreateWebhookInput,
): Promise<ActionResult<CreatedWebhookResult>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();
    const data = createWebhookSchema.parse(input);

    const { record, secret } = await createWebhook(session.organizationId, session.id, data);

    await logActivity({
      organizationId: session.organizationId,
      entityType: "ORGANIZATION",
      entityId: session.organizationId,
      type: "webhook_created",
      message: record.url,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    return {
      success: true,
      data: {
        id: record.id,
        url: record.url,
        subscribedEvents: record.subscribedEvents,
        secret,
      },
    };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Enable/disable a webhook without deleting its delivery history. */
export async function toggleWebhook(
  id: string,
  isActive: boolean,
): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();

    const webhook = await getWebhookById(session.organizationId, id);
    if (!webhook) return { success: false, error: "Webhook not found." };

    await setWebhookActive(session.organizationId, id, isActive);

    await logActivity({
      organizationId: session.organizationId,
      entityType: "ORGANIZATION",
      entityId: session.organizationId,
      type: isActive ? "webhook_enabled" : "webhook_disabled",
      message: webhook.url,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: { isActive } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Delete a webhook subscription and its delivery history (atomic). */
export async function removeWebhook(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();

    const webhook = await getWebhookById(session.organizationId, id);
    if (!webhook) return { success: false, error: "Webhook not found." };

    await deleteWebhook(session.organizationId, id);

    await logActivity({
      organizationId: session.organizationId,
      entityType: "ORGANIZATION",
      entityId: session.organizationId,
      type: "webhook_deleted",
      message: webhook.url,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: { id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
