import {
  ACTION_TYPES,
  AUTOMATION_TRIGGERS,
  CONDITION_OPERATORS,
  type ActionType,
  type AutomationRunStatus,
  type ConditionOperator,
  type TriggerType,
} from "@/features/automation/types";

/**
 * Automation display labels (Phase 6B Step 6, §13). Client-safe lookups shared by
 * the RuleList, RuleBuilder, and AutomationLogTable so the UI never re-derives a
 * human label from a raw enum value.
 */

const TRIGGER_LABEL = Object.fromEntries(
  AUTOMATION_TRIGGERS.map((t) => [t.value, t.label]),
) as Record<TriggerType, string>;

const OPERATOR_LABEL = Object.fromEntries(
  CONDITION_OPERATORS.map((o) => [o.value, o.label]),
) as Record<ConditionOperator, string>;

const ACTION_LABEL = Object.fromEntries(
  ACTION_TYPES.map((a) => [a.value, a.label]),
) as Record<ActionType, string>;

export function triggerLabel(value: string): string {
  return TRIGGER_LABEL[value as TriggerType] ?? value;
}

export function operatorLabel(value: string): string {
  return OPERATOR_LABEL[value as ConditionOperator] ?? value;
}

export function actionLabel(value: string): string {
  return ACTION_LABEL[value as ActionType] ?? value;
}

export const RUN_STATUS_LABELS: Record<AutomationRunStatus, string> = {
  SUCCESS: "Success",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

export const RUN_STATUS_COLORS: Record<AutomationRunStatus, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-slate-100 text-slate-700",
};
