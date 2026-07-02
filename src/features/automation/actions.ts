"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireActiveUser, requireRole } from "@/lib/permissions";
import { toActionError } from "@/lib/errors";
import { logActivity } from "@/features/activity/actions";
import {
  createAutomationRule,
  getAutomationRuleById,
  setAutomationRuleActive,
  updateAutomationRule,
} from "@/features/automation/repository";
import {
  createAutomationRuleSchema,
  type CreateAutomationRuleInput,
} from "@/features/automation/validation";
import type { ActionResult } from "@/types";

/**
 * Automation rule management actions (Phase 6B Step 6, §15.8).
 *
 * The only client-callable write surface for rules — every action is OWNER-only
 * (rules change org-wide business behavior, the same justification Phase 5 used
 * for Catalog writes). There is deliberately **no** action that executes a rule:
 * execution is server-authoritative and event-driven, never invoked from a
 * request (§15.8, "rule execution carries no user-facing permission check of its
 * own — it runs from inside the already-permission-checked action"). Payloads
 * are validated against the closed schema before persistence (§15.9).
 */

const SETTINGS_PATH = "/settings/automations";

/** Create a new automation rule. */
export async function createRule(
  input: CreateAutomationRuleInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();
    const data = createAutomationRuleSchema.parse(input);

    const rule = await createAutomationRule(session.organizationId, session.id, data);

    await logActivity({
      organizationId: session.organizationId,
      entityType: "ORGANIZATION",
      entityId: session.organizationId,
      type: "automation_rule_created",
      message: rule.name,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: { id: rule.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Update an existing rule (org-scoped). */
export async function updateRule(
  id: string,
  input: CreateAutomationRuleInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();
    const data = createAutomationRuleSchema.parse(input);

    const result = await updateAutomationRule(session.organizationId, id, data);
    if (result.count === 0) return { success: false, error: "Rule not found." };

    await logActivity({
      organizationId: session.organizationId,
      entityType: "ORGANIZATION",
      entityId: session.organizationId,
      type: "automation_rule_updated",
      message: data.name,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    revalidatePath(`${SETTINGS_PATH}/${id}`);
    return { success: true, data: { id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Enable/disable a rule without deleting it (§15.8, `deactivateRule`). */
export async function toggleRule(
  id: string,
  isActive: boolean,
): Promise<ActionResult<{ isActive: boolean }>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();

    const ok = await setAutomationRuleActive(session.organizationId, id, isActive);
    if (!ok) return { success: false, error: "Rule not found." };

    const rule = await getAutomationRuleById(session.organizationId, id);
    await logActivity({
      organizationId: session.organizationId,
      entityType: "ORGANIZATION",
      entityId: session.organizationId,
      type: isActive ? "automation_rule_enabled" : "automation_rule_disabled",
      message: rule?.name,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    revalidatePath(`${SETTINGS_PATH}/${id}`);
    return { success: true, data: { isActive } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
