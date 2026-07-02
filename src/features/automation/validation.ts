import { z } from "zod";

import {
  AUTOMATION_EMAIL_TEMPLATES,
  AUTOMATION_TRIGGERS,
  CONDITION_OPERATORS,
  type ConditionOperator,
  type TriggerType,
} from "@/features/automation/types";

/**
 * Automation rule validation (Phase 6B Step 6, §15.9).
 *
 * The closed schema that turns "configurable automation" from a code-injection
 * surface into structured data. `triggerType`, every condition `op`, and every
 * action `type` are validated against a FIXED set — anything outside the set is
 * rejected at the schema boundary, so a stored rule can never ask the engine to
 * do something `runAction()` doesn't explicitly implement (§15.9). The same
 * schema is enforced on write (the CRUD actions) and re-parsed at execution
 * (defense in depth, §15.10): a rule that somehow held malformed JSON is logged
 * and skipped, never executed blindly.
 *
 * Step 1 shipped a deliberately loose placeholder here ("without prematurely
 * freezing the vocabulary the engine will define"). Step 6 defines it — this is
 * that closed vocabulary.
 */

// Cast to literal tuples so `z.enum` infers the precise union (not `string`).
const triggerValues = AUTOMATION_TRIGGERS.map((t) => t.value) as [TriggerType, ...TriggerType[]];
const operatorValues = CONDITION_OPERATORS.map((o) => o.value) as [
  ConditionOperator,
  ...ConditionOperator[],
];
const emailTemplateValues = AUTOMATION_EMAIL_TEMPLATES as [string, ...string[]];

/** A single condition clause. `value` is a string; the engine coerces per operator. */
export const conditionSchema = z.object({
  field: z.string().trim().min(1, "Choose a field.").max(60),
  op: z.enum(operatorValues),
  value: z.string().trim().max(200).default(""),
});

/** Conditions are AND-combined; an empty array means "always run". */
export const conditionsSchema = z.array(conditionSchema).max(10).default([]);

const notificationPriority = z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL");
const notifyRole = z.enum(["OWNER", "STAFF"]).default("OWNER");

/** The closed action union — every branch maps 1:1 to a `runAction()` case. */
export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("send_notification"),
    title: z.string().trim().min(1, "A notification needs a title.").max(120),
    body: z.string().trim().max(400).optional(),
    priority: notificationPriority,
    role: notifyRole,
  }),
  z.object({
    type: z.literal("send_email"),
    template: z.enum(emailTemplateValues),
  }),
  z.object({
    type: z.literal("create_task"),
    title: z.string().trim().min(1, "A task needs a title.").max(300),
    dueInDays: z.number().int().min(0).max(365).optional(),
  }),
  z.object({
    type: z.literal("log_activity"),
    message: z.string().trim().min(1, "Add a note.").max(500),
  }),
]);

/** Every rule needs at least one action to be meaningful. */
export const actionsSchema = z
  .array(actionSchema)
  .min(1, "Add at least one action.")
  .max(10);

/** The `{ conditions, actions }` pair stored as JSON — re-parsed at execution. */
export const ruleConfigSchema = z.object({
  conditions: conditionsSchema,
  actions: actionsSchema,
});

/** Full create payload for a rule. */
export const createAutomationRuleSchema = z.object({
  name: z.string().trim().min(1, "Name your rule.").max(120),
  triggerType: z.enum(triggerValues),
  conditions: conditionsSchema,
  actions: actionsSchema,
  isActive: z.boolean().default(true),
});

export type CreateAutomationRuleInput = z.infer<typeof createAutomationRuleSchema>;

/** Partial update — every field optional; the closed shape is still enforced. */
export const updateAutomationRuleSchema = createAutomationRuleSchema.partial();

export type UpdateAutomationRuleInput = z.infer<typeof updateAutomationRuleSchema>;

export type RuleConfig = z.infer<typeof ruleConfigSchema>;

/** Terminal statuses for an execution log row (§7.2.5). */
export const AUTOMATION_LOG_STATUSES = ["SUCCESS", "FAILED", "SKIPPED"] as const;
export type AutomationLogStatus = (typeof AUTOMATION_LOG_STATUSES)[number];
