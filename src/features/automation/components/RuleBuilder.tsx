"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { showSuccessToast } from "@/components/shared/SuccessToast";
import {
  CheckboxField,
  SelectField,
  TextField,
  TextareaField,
} from "@/features/settings/components/fields";
import {
  ACTION_TYPES,
  AUTOMATION_TRIGGERS,
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  EMAIL_TEMPLATE_CHOICES,
  TRIGGER_ENTITY,
  UNARY_OPERATORS,
  type ActionType,
  type AutomationAction,
  type AutomationCondition,
  type ConditionOperator,
  type NotificationPriority,
  type NotifyRole,
  type TriggerType,
} from "@/features/automation/types";
import { createRule, updateRule } from "@/features/automation/actions";

/**
 * RuleBuilder (§15.5) — a form over the closed `conditions`/`actions` shapes, not
 * a visual flowchart (that richer UI is a named future investment, §15.13). The
 * trigger picks the entity, which drives the available condition fields and email
 * templates, so a rule can only ever reference things the engine can evaluate.
 * The payload is re-validated server-side (§15.9); this form is convenience, not
 * the source of truth.
 */

type ConditionRow = { field: string; op: ConditionOperator; value: string };
type ActionRow = {
  type: ActionType;
  title: string;
  body: string;
  priority: NotificationPriority;
  role: NotifyRole;
  template: string;
  message: string;
  dueInDays: string;
};

type Entity = keyof typeof CONDITION_FIELDS;

export type RuleBuilderInitial = {
  name: string;
  triggerType: TriggerType;
  isActive: boolean;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

const isUnary = (op: ConditionOperator) => (UNARY_OPERATORS as readonly string[]).includes(op);

function firstField(entity: Entity): string {
  return CONDITION_FIELDS[entity][0]?.value ?? "";
}

function newCondition(entity: Entity): ConditionRow {
  return { field: firstField(entity), op: "eq", value: "" };
}

function newAction(entity: Entity): ActionRow {
  return {
    type: "send_notification",
    title: "",
    body: "",
    priority: "NORMAL",
    role: "OWNER",
    template: EMAIL_TEMPLATE_CHOICES[entity][0]?.value ?? "",
    message: "",
    dueInDays: "",
  };
}

function toActionRow(entity: Entity, action: AutomationAction): ActionRow {
  const base = newAction(entity);
  switch (action.type) {
    case "send_notification":
      return {
        ...base,
        type: "send_notification",
        title: action.title,
        body: action.body ?? "",
        priority: action.priority,
        role: action.role,
      };
    case "send_email":
      return { ...base, type: "send_email", template: action.template };
    case "create_task":
      return {
        ...base,
        type: "create_task",
        title: action.title,
        dueInDays: action.dueInDays !== undefined ? String(action.dueInDays) : "",
      };
    case "log_activity":
      return { ...base, type: "log_activity", message: action.message };
  }
}

function buildAction(row: ActionRow): AutomationAction {
  switch (row.type) {
    case "send_notification":
      return {
        type: "send_notification",
        title: row.title,
        body: row.body.trim() ? row.body : undefined,
        priority: row.priority,
        role: row.role,
      };
    case "send_email":
      return { type: "send_email", template: row.template };
    case "create_task":
      return {
        type: "create_task",
        title: row.title,
        dueInDays: row.dueInDays.trim() ? Number(row.dueInDays) : undefined,
      };
    case "log_activity":
      return { type: "log_activity", message: row.message };
  }
}

export function RuleBuilder({
  mode,
  ruleId,
  initial,
}: {
  mode: "create" | "edit";
  ruleId?: string;
  initial?: RuleBuilderInitial;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const initialTrigger = initial?.triggerType ?? AUTOMATION_TRIGGERS[0].value;
  const initialEntity = TRIGGER_ENTITY[initialTrigger];

  const [name, setName] = useState(initial?.name ?? "");
  const [triggerType, setTriggerType] = useState<TriggerType>(initialTrigger);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [conditions, setConditions] = useState<ConditionRow[]>(
    initial?.conditions.map((c) => ({ field: c.field, op: c.op, value: c.value })) ?? [],
  );
  const [actions, setActions] = useState<ActionRow[]>(
    initial?.actions.map((a) => toActionRow(initialEntity, a)) ?? [newAction(initialEntity)],
  );

  const entity = TRIGGER_ENTITY[triggerType];
  const fieldOptions = CONDITION_FIELDS[entity];
  const templateOptions = EMAIL_TEMPLATE_CHOICES[entity];
  const actionTypeOptions = useMemo(
    () => ACTION_TYPES.filter((a) => a.value !== "send_email" || templateOptions.length > 0),
    [templateOptions.length],
  );

  function handleTriggerChange(value: string) {
    const next = value as TriggerType;
    const nextEntity = TRIGGER_ENTITY[next];
    setTriggerType(next);
    // Keep conditions/actions valid for the new entity.
    setConditions((prev) =>
      prev.map((c) =>
        CONDITION_FIELDS[nextEntity].some((f) => f.value === c.field)
          ? c
          : { ...c, field: firstField(nextEntity) },
      ),
    );
    setActions((prev) =>
      prev.map((a) => {
        if (a.type !== "send_email") return a;
        const opts = EMAIL_TEMPLATE_CHOICES[nextEntity];
        if (opts.length === 0) return { ...a, type: "send_notification" };
        if (!opts.some((o) => o.value === a.template)) return { ...a, template: opts[0].value };
        return a;
      }),
    );
  }

  function updateCondition(index: number, patch: Partial<ConditionRow>) {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function updateAction(index: number, patch: Partial<ActionRow>) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const payload = {
      name,
      triggerType,
      isActive,
      conditions: conditions.map((c) => ({
        field: c.field,
        op: c.op,
        value: isUnary(c.op) ? "" : c.value,
      })),
      actions: actions.map(buildAction),
    };

    startTransition(async () => {
      const result =
        mode === "edit" && ruleId
          ? await updateRule(ruleId, payload)
          : await createRule(payload);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      showSuccessToast(mode === "edit" ? "Rule saved" : "Rule created");
      router.push("/settings/automations");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <TextField
        id="name"
        label="Rule name"
        value={name}
        onChange={setName}
        hint="A short description, e.g. “Alert on high-value quotes”."
      />

      <SelectField
        id="triggerType"
        label="When this happens"
        value={triggerType}
        onChange={handleTriggerChange}
        options={AUTOMATION_TRIGGERS.map((t) => ({ value: t.value, label: t.label }))}
        hint="The business event that starts this rule."
      />

      {/* Conditions -------------------------------------------------------- */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Only if (optional)</legend>
        {conditions.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No conditions — the rule runs every time the trigger fires.
          </p>
        ) : (
          conditions.map((c, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
              <div className="min-w-40 flex-1">
                <SelectField
                  id={`cond-field-${i}`}
                  label="Field"
                  value={c.field}
                  onChange={(v) => updateCondition(i, { field: v })}
                  options={fieldOptions.map((f) => ({ value: f.value, label: f.label }))}
                />
              </div>
              <div className="min-w-40 flex-1">
                <SelectField
                  id={`cond-op-${i}`}
                  label="Is"
                  value={c.op}
                  onChange={(v) => updateCondition(i, { op: v as ConditionOperator })}
                  options={CONDITION_OPERATORS.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
              {!isUnary(c.op) ? (
                <div className="min-w-40 flex-1">
                  <TextField
                    id={`cond-value-${i}`}
                    label="Value"
                    value={c.value}
                    onChange={(v) => updateCondition(i, { value: v })}
                  />
                </div>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove condition"
                onClick={() => setConditions((prev) => prev.filter((_, idx) => idx !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setConditions((prev) => [...prev, newCondition(entity)])}
        >
          <Plus /> Add condition
        </Button>
      </fieldset>

      {/* Actions ----------------------------------------------------------- */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Do this</legend>
        {actions.map((a, i) => (
          <div key={i} className="space-y-3 rounded-md border p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SelectField
                  id={`action-type-${i}`}
                  label={`Action ${i + 1}`}
                  value={a.type}
                  onChange={(v) => updateAction(i, { type: v as ActionType })}
                  options={actionTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
                />
              </div>
              {actions.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove action"
                  onClick={() => setActions((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>

            {a.type === "send_notification" ? (
              <>
                <TextField
                  id={`action-title-${i}`}
                  label="Notification title"
                  value={a.title}
                  onChange={(v) => updateAction(i, { title: v })}
                />
                <TextareaField
                  id={`action-body-${i}`}
                  label="Message (optional)"
                  value={a.body}
                  onChange={(v) => updateAction(i, { body: v })}
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <SelectField
                    id={`action-priority-${i}`}
                    label="Priority"
                    value={a.priority}
                    onChange={(v) => updateAction(i, { priority: v as NotificationPriority })}
                    options={[
                      { value: "LOW", label: "Low" },
                      { value: "NORMAL", label: "Normal" },
                      { value: "HIGH", label: "High" },
                    ]}
                  />
                  <SelectField
                    id={`action-role-${i}`}
                    label="Notify"
                    value={a.role}
                    onChange={(v) => updateAction(i, { role: v as NotifyRole })}
                    options={[
                      { value: "OWNER", label: "Owners" },
                      { value: "STAFF", label: "Staff" },
                    ]}
                  />
                </div>
              </>
            ) : null}

            {a.type === "send_email" ? (
              <SelectField
                id={`action-template-${i}`}
                label="Email template"
                value={a.template}
                onChange={(v) => updateAction(i, { template: v })}
                options={templateOptions}
                hint="Sent to the record's customer, using the existing email templates."
              />
            ) : null}

            {a.type === "create_task" ? (
              <div className="grid grid-cols-[2fr_1fr] gap-2">
                <TextField
                  id={`action-tasktitle-${i}`}
                  label="Task title"
                  value={a.title}
                  onChange={(v) => updateAction(i, { title: v })}
                />
                <TextField
                  id={`action-due-${i}`}
                  label="Due in (days)"
                  type="number"
                  value={a.dueInDays}
                  onChange={(v) => updateAction(i, { dueInDays: v })}
                />
              </div>
            ) : null}

            {a.type === "log_activity" ? (
              <TextField
                id={`action-message-${i}`}
                label="Timeline note"
                value={a.message}
                onChange={(v) => updateAction(i, { message: v })}
              />
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setActions((prev) => [...prev, newAction(entity)])}
        >
          <Plus /> Add action
        </Button>
      </fieldset>

      <CheckboxField
        id="isActive"
        label="Active"
        checked={isActive}
        onChange={setIsActive}
        hint="Only active rules fire. You can disable a rule at any time without deleting it."
      />

      <div className="flex items-center justify-between gap-4 border-t pt-4">
        <div aria-live="polite" className="text-sm">
          {formError ? <span className="text-destructive">{formError}</span> : null}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/settings/automations")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : mode === "edit" ? "Save rule" : "Create rule"}
          </Button>
        </div>
      </div>
    </form>
  );
}
