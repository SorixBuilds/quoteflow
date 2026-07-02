import "server-only";

import { requireCompanyScope, requireRole } from "@/lib/permissions";
import {
  getAutomationRuleById,
  listAutomationLogs,
  listAutomationRules,
} from "@/features/automation/repository";
import { ruleConfigSchema } from "@/features/automation/validation";
import type {
  AutomationAction,
  AutomationCondition,
  AutomationRunStatus,
  TriggerType,
} from "@/features/automation/types";

/**
 * Automation read path (Phase 6B Step 6, §15.5). OWNER-only, company-scoped —
 * the management screen's list, a single rule's editable detail, and a rule's
 * execution history. Stored JSON is re-parsed through the closed schema before
 * it reaches the UI, so the editor only ever sees well-formed conditions/actions
 * (a legacy/corrupt blob degrades to empty rather than crashing the page).
 */

export type AutomationRuleListItem = {
  id: string;
  name: string;
  triggerType: TriggerType;
  isActive: boolean;
  conditionCount: number;
  actionCount: number;
  createdAt: Date;
};

export type AutomationRuleDetail = {
  id: string;
  name: string;
  triggerType: TriggerType;
  isActive: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

export type AutomationLogView = {
  id: string;
  status: AutomationRunStatus;
  resultMessage: string | null;
  executedAt: Date;
  entityId: string | null;
};

function parseConfig(conditions: unknown, actions: unknown): {
  conditions: AutomationCondition[];
  actions: AutomationAction[];
} {
  const parsed = ruleConfigSchema.safeParse({ conditions, actions });
  if (!parsed.success) return { conditions: [], actions: [] };
  return { conditions: parsed.data.conditions, actions: parsed.data.actions };
}

/** Every rule for the org (management list), newest first. */
export async function listRulesForOrg(): Promise<AutomationRuleListItem[]> {
  const session = await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope(session);
  const rules = await listAutomationRules(organizationId);

  return rules.map((rule) => {
    const { conditions, actions } = parseConfig(rule.conditions, rule.actions);
    return {
      id: rule.id,
      name: rule.name,
      triggerType: rule.triggerType as TriggerType,
      isActive: rule.isActive,
      conditionCount: conditions.length,
      actionCount: actions.length,
      createdAt: rule.createdAt,
    };
  });
}

/** A single rule in editable form, org-scoped. */
export async function getRuleDetail(id: string): Promise<AutomationRuleDetail | null> {
  const session = await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope(session);
  const rule = await getAutomationRuleById(organizationId, id);
  if (!rule) return null;

  const { conditions, actions } = parseConfig(rule.conditions, rule.actions);
  return {
    id: rule.id,
    name: rule.name,
    triggerType: rule.triggerType as TriggerType,
    isActive: rule.isActive,
    conditions,
    actions,
  };
}

/** A rule's recent execution history, newest first (org-scoped by rule lookup). */
export async function getRuleLogs(id: string, take = 50): Promise<AutomationLogView[]> {
  const session = await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope(session);
  // Ownership check: the rule must belong to the caller's org before its logs
  // are exposed (IDOR guard — logs are reached only through an owned rule).
  const rule = await getAutomationRuleById(organizationId, id);
  if (!rule) return [];

  const logs = await listAutomationLogs(id, take);
  return logs.map((log) => ({
    id: log.id,
    status: log.status as AutomationRunStatus,
    resultMessage: log.resultMessage,
    executedAt: log.executedAt,
    entityId: log.entityId,
  }));
}
