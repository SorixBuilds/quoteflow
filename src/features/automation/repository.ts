import type {
  AutomationLog,
  AutomationRule,
  EntityType,
  Prisma,
} from "@prisma/client";

import { db } from "@/lib/db";
import { TRIGGER_ENTITY, type TriggerType } from "@/features/automation/types";
import type {
  AutomationLogStatus,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from "@/features/automation/validation";

/**
 * AutomationRule + AutomationLog repository (§7.2.5, §15) — pure persistence for
 * the automation engine. Rules are organization-scoped; log rows are reached
 * through their parent rule. The hot path — "which active rules fire for this
 * trigger?" — is served by {@link getRulesForTrigger}, backed by the
 * `(organizationId, triggerType, isActive)` index.
 *
 * `conditions`/`actions` are stored as JSON exactly as validated; this layer
 * evaluates nothing (that is the engine's job in a later step).
 */

/** Create a rule. */
export function createAutomationRule(
  organizationId: string,
  createdById: string,
  input: CreateAutomationRuleInput,
): Promise<AutomationRule> {
  return db.automationRule.create({
    data: {
      organizationId,
      createdById,
      name: input.name,
      triggerType: input.triggerType,
      // Entity is a deterministic function of the trigger — server-derived, never
      // client-supplied, so a condition always evaluates against the right shape.
      triggerEntity: TRIGGER_ENTITY[input.triggerType as TriggerType],
      conditions: input.conditions as Prisma.InputJsonValue,
      actions: input.actions as unknown as Prisma.InputJsonValue,
      isActive: input.isActive ?? true,
    },
  });
}

/** Update a rule, org-scoped. Only provided fields change. */
export function updateAutomationRule(
  organizationId: string,
  id: string,
  input: UpdateAutomationRuleInput,
): Promise<Prisma.BatchPayload> {
  return db.automationRule.updateMany({
    where: { id, organizationId },
    data: {
      name: input.name,
      triggerType: input.triggerType,
      triggerEntity: input.triggerType
        ? TRIGGER_ENTITY[input.triggerType as TriggerType]
        : undefined,
      conditions: input.conditions as Prisma.InputJsonValue | undefined,
      actions: input.actions as unknown as Prisma.InputJsonValue | undefined,
      isActive: input.isActive,
    },
  });
}

/** Activate/deactivate a rule without deleting it, org-scoped. */
export async function setAutomationRuleActive(
  organizationId: string,
  id: string,
  isActive: boolean,
): Promise<boolean> {
  const result = await db.automationRule.updateMany({
    where: { id, organizationId },
    data: { isActive },
  });
  return result.count > 0;
}

/** All rules for an organization (management screen), newest first. */
export function listAutomationRules(organizationId: string): Promise<AutomationRule[]> {
  return db.automationRule.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

/** A single rule, org-scoped. */
export function getAutomationRuleById(
  organizationId: string,
  id: string,
): Promise<AutomationRule | null> {
  return db.automationRule.findFirst({ where: { id, organizationId } });
}

/** Active rules for a trigger — the engine's hot lookup (indexed). */
export function getRulesForTrigger(
  organizationId: string,
  triggerType: string,
): Promise<AutomationRule[]> {
  return db.automationRule.findMany({
    where: { organizationId, triggerType, isActive: true },
  });
}

// --- Execution log ----------------------------------------------------------

/** Input to record a rule execution. */
export type CreateAutomationLogInput = {
  ruleId: string;
  entityType?: EntityType;
  entityId?: string;
  status: AutomationLogStatus;
  resultMessage?: string;
};

/** Append an execution record for a rule. */
export function createAutomationLog(
  input: CreateAutomationLogInput,
): Promise<AutomationLog> {
  return db.automationLog.create({
    data: {
      ruleId: input.ruleId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: input.status,
      resultMessage: input.resultMessage,
    },
  });
}

/** Execution history for a rule, newest first. */
export function listAutomationLogs(ruleId: string, take = 100): Promise<AutomationLog[]> {
  return db.automationLog.findMany({
    where: { ruleId },
    orderBy: { executedAt: "desc" },
    take,
  });
}

/**
 * The most recent execution of a rule against a specific entity — backs the
 * time-based "fire at most once per day" guard (§15) as a single indexed lookup.
 */
export function getLastLogForRuleEntity(
  ruleId: string,
  entityType: EntityType,
  entityId: string,
): Promise<AutomationLog | null> {
  return db.automationLog.findFirst({
    where: { ruleId, entityType, entityId },
    orderBy: { executedAt: "desc" },
  });
}
