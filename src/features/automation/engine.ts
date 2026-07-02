import "server-only";

import type { AutomationRule } from "@prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { logActivity } from "@/features/activity/actions";
import { rebuildEmailJob } from "@/features/email/dispatch";
import { sendTemplatedEmail } from "@/features/email/send";
import {
  TRIGGER_ENTITY,
  type AutomationAction,
  type AutomationEntityType,
  type TriggerType,
} from "@/features/automation/types";
import { evaluateConditions, type EntitySnapshot } from "@/features/automation/conditions";
import { loadEntitySnapshot, resolveSystemActorId } from "@/features/automation/entity-fields";
import {
  createAutomationLog,
  getLastLogForRuleEntity,
  getRulesForTrigger,
} from "@/features/automation/repository";
import { ruleConfigSchema, type AutomationLogStatus } from "@/features/automation/validation";

/**
 * Automation Engine — evaluation + action execution (Phase 6B Step 6, §15.6–15.10).
 *
 * The orchestration layer. It never re-implements business logic: every action
 * is a thin call to a service that already exists (Email System, Notification
 * producer, Activity writer, Task writer). `fireTrigger` is the single entry
 * point the event subscribers call; it loads the matching active rules, loads a
 * server-authoritative snapshot of the entity, evaluates each rule's conditions,
 * runs its actions in order, and writes exactly one `AutomationLog` row per rule
 * per firing.
 *
 * Two isolation guarantees hold absolutely:
 *  - A failing action is caught per-action (§15.10): its siblings still run, and
 *    the rule is logged FAILED with the error — never rolled back.
 *  - `fireTrigger` never throws. Automation is observability, never a reason the
 *    business event that triggered it (a Quote-accept, an Invoice-create) fails.
 *
 * No action in the closed set publishes a domain event, so a rule firing can
 * never re-enter the engine — infinite trigger chains are impossible by
 * construction, not by a runtime depth counter.
 */

type ActionContext = {
  organizationId: string;
  entityType: AutomationEntityType;
  entityId: string;
  /** Resolves (and memoizes) the org's system actor — only when an action needs it. */
  actorId: () => Promise<string | null>;
};

const ENTITY_PATH: Record<AutomationEntityType, string> = {
  LEAD: "leads",
  QUOTE: "quotes",
  JOB: "jobs",
  INVOICE: "invoices",
  CUSTOMER: "customers",
};

function isTriggerType(value: string): value is TriggerType {
  return value in TRIGGER_ENTITY;
}

/** Build a memoized system-actor resolver shared across a firing batch. */
function makeActorResolver(organizationId: string): () => Promise<string | null> {
  let cached: string | null | undefined;
  return async () => {
    if (cached === undefined) cached = await resolveSystemActorId(organizationId);
    return cached;
  };
}

/** Execute a single action. Throws on failure so the caller can isolate + log it. */
async function runAction(action: AutomationAction, ctx: ActionContext): Promise<void> {
  switch (action.type) {
    case "send_notification": {
      const recipients = await db.user.findMany({
        where: { organizationId: ctx.organizationId, role: action.role, isActive: true },
        select: { id: true },
      });
      if (recipients.length === 0) return;
      await db.notification.createMany({
        data: recipients.map((u) => ({
          organizationId: ctx.organizationId,
          userId: u.id,
          type: "automation_executed",
          title: action.title,
          body: action.body ?? null,
          priority: action.priority,
          entityType: ctx.entityType,
          entityId: ctx.entityId,
          actionUrl: `/${ENTITY_PATH[ctx.entityType]}/${ctx.entityId}`,
          actionLabel: "View",
        })),
      });
      return;
    }
    case "send_email": {
      // Reuse the Email System end-to-end — re-derive the template from the live
      // entity (never compose content here) and hand it to the single send funnel.
      const job = await rebuildEmailJob(ctx.organizationId, {
        templateType: action.template,
        relatedEntityId: ctx.entityId,
      });
      if (!job) return; // no recipient / template not applicable → no-op
      await sendTemplatedEmail({ organizationId: ctx.organizationId, ...job });
      return;
    }
    case "create_task": {
      const actorId = await ctx.actorId();
      if (!actorId) return;
      const dueDate =
        action.dueInDays !== undefined
          ? new Date(Date.now() + action.dueInDays * 86_400_000)
          : null;
      await db.task.create({
        data: {
          organizationId: ctx.organizationId,
          entityType: ctx.entityType,
          entityId: ctx.entityId,
          title: action.title,
          dueDate,
          assignedToId: actorId,
          createdById: actorId,
        },
      });
      return;
    }
    case "log_activity": {
      const actorId = await ctx.actorId();
      if (!actorId) return;
      await logActivity({
        organizationId: ctx.organizationId,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        type: "automation_executed",
        message: action.message,
        createdById: actorId,
      });
      return;
    }
  }
}

async function logRun(
  rule: AutomationRule,
  entityType: AutomationEntityType,
  entityId: string,
  status: AutomationLogStatus,
  resultMessage?: string,
): Promise<void> {
  await createAutomationLog({ ruleId: rule.id, entityType, entityId, status, resultMessage });
}

/** Evaluate + execute one rule against the snapshot, logging the outcome. */
async function runRule(
  rule: AutomationRule,
  entityType: AutomationEntityType,
  entityId: string,
  snapshot: EntitySnapshot,
  ctx: ActionContext,
): Promise<void> {
  // Re-parse the stored JSON against the closed schema (defense in depth, §15.10).
  const parsed = ruleConfigSchema.safeParse({
    conditions: rule.conditions,
    actions: rule.actions,
  });
  if (!parsed.success) {
    await logRun(rule, entityType, entityId, "FAILED", "Invalid rule configuration.");
    return;
  }

  if (!evaluateConditions(parsed.data.conditions, snapshot)) {
    await logRun(rule, entityType, entityId, "SKIPPED", "Conditions not met.");
    return;
  }

  const errors: string[] = [];
  for (const action of parsed.data.actions) {
    try {
      await runAction(action, ctx);
    } catch (error) {
      // Per-action isolation (§15.10): record and keep going.
      errors.push(`${action.type}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await logRun(
    rule,
    entityType,
    entityId,
    errors.length > 0 ? "FAILED" : "SUCCESS",
    errors.length > 0 ? errors.join(" | ") : `${parsed.data.actions.length} action(s) executed.`,
  );
}

export type FireTriggerOptions = {
  /**
   * Time-based guard (§15.7): fire a given (rule, entity) pair at most once per
   * UTC day, so a lazily-evaluated trigger (`invoice.overdue`) can't storm every
   * time a list page is viewed.
   */
  oncePerDay?: boolean;
};

/**
 * The engine's single entry point. Loads active rules for the trigger, snapshots
 * the entity server-side, and runs each rule. Never throws.
 */
export async function fireTrigger(
  triggerType: string,
  entityId: string,
  organizationId: string,
  options: FireTriggerOptions = {},
): Promise<void> {
  try {
    if (!isTriggerType(triggerType)) return;
    const entityType = TRIGGER_ENTITY[triggerType];

    const rules = await getRulesForTrigger(organizationId, triggerType);
    if (rules.length === 0) return;

    const snapshot = await loadEntitySnapshot(entityType, entityId, organizationId);
    if (!snapshot) return;

    const ctx: ActionContext = {
      organizationId,
      entityType,
      entityId,
      actorId: makeActorResolver(organizationId),
    };

    for (const rule of rules) {
      if (options.oncePerDay && (await firedToday(rule.id, entityType, entityId))) {
        continue; // already fired for this (rule, entity) today — silent no-op
      }
      await runRule(rule, entityType, entityId, snapshot, ctx);
    }
  } catch (error) {
    logger.error("fireTrigger failed", {
      triggerType,
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Time-based `invoice.overdue` firing, evaluated lazily on read (§15.7). Called
 * from the Invoices list query for the invoices it just computed as overdue. The
 * common case — an org with no overdue rule — costs exactly one indexed rule
 * lookup and returns; no snapshot loads, no per-invoice work. When a rule does
 * exist, each (rule, invoice) pair fires at most once per UTC day. Never throws:
 * a read path must never fail because of automation.
 */
export async function fireOverdueOnRead(
  organizationId: string,
  invoiceIds: string[],
): Promise<void> {
  try {
    if (invoiceIds.length === 0) return;
    const rules = await getRulesForTrigger(organizationId, "invoice.overdue");
    if (rules.length === 0) return;

    const actorId = makeActorResolver(organizationId);
    for (const invoiceId of invoiceIds) {
      const due: AutomationRule[] = [];
      for (const rule of rules) {
        if (!(await firedToday(rule.id, "INVOICE", invoiceId))) due.push(rule);
      }
      if (due.length === 0) continue;

      const snapshot = await loadEntitySnapshot("INVOICE", invoiceId, organizationId);
      if (!snapshot) continue;
      const ctx: ActionContext = { organizationId, entityType: "INVOICE", entityId: invoiceId, actorId };
      for (const rule of due) {
        await runRule(rule, "INVOICE", invoiceId, snapshot, ctx);
      }
    }
  } catch (error) {
    logger.error("fireOverdueOnRead failed", {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Whether this (rule, entity) already has a log row dated today (UTC). */
async function firedToday(
  ruleId: string,
  entityType: AutomationEntityType,
  entityId: string,
): Promise<boolean> {
  const last = await getLastLogForRuleEntity(ruleId, entityType, entityId);
  if (!last) return false;
  const now = new Date();
  return (
    last.executedAt.getUTCFullYear() === now.getUTCFullYear() &&
    last.executedAt.getUTCMonth() === now.getUTCMonth() &&
    last.executedAt.getUTCDate() === now.getUTCDate()
  );
}
