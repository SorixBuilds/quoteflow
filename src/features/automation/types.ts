/**
 * Automation Engine — closed taxonomy + shared types (Phase 6B Step 6, §15).
 *
 * The single source of truth for what an automation rule may reference: a fixed
 * set of triggers, a fixed set of condition operators, a fixed set of action
 * types, and — per triggering entity — the whitelist of fields a condition may
 * name and the templates a `send_email` action may dispatch. This closed
 * catalog is what makes the engine safe (§15.9): a rule is structured data
 * validated against these sets, never arbitrary code, so it can only ever ask
 * the engine to do something `runAction()` already implements.
 *
 * Client-safe: no server imports, so the RuleBuilder UI imports the same
 * catalogs the server validates against — one vocabulary, no drift.
 */

/** The five business entities automation can trigger on (never ORGANIZATION). */
export type AutomationEntityType = "LEAD" | "QUOTE" | "JOB" | "INVOICE" | "CUSTOMER";

/**
 * The trigger catalog. Each `value` is a domain-event name (§6 taxonomy) — the
 * engine subscribes to that event and fires rules whose `triggerType` matches.
 * `invoice.overdue` is the one time-based trigger (fired lazily on read, §15.7).
 */
export const AUTOMATION_TRIGGERS = [
  { value: "lead.created", label: "Lead created", entity: "LEAD" },
  { value: "lead.converted", label: "Lead marked Won", entity: "LEAD" },
  { value: "quote.created", label: "Quote created", entity: "QUOTE" },
  { value: "quote.sent", label: "Quote sent", entity: "QUOTE" },
  { value: "quote.accepted", label: "Quote accepted", entity: "QUOTE" },
  { value: "quote.declined", label: "Quote declined", entity: "QUOTE" },
  { value: "job.scheduled", label: "Job scheduled", entity: "JOB" },
  { value: "job.completed", label: "Job completed", entity: "JOB" },
  { value: "invoice.created", label: "Invoice issued", entity: "INVOICE" },
  { value: "invoice.overdue", label: "Invoice overdue", entity: "INVOICE" },
  { value: "payment.recorded", label: "Payment recorded", entity: "INVOICE" },
  { value: "customer.created", label: "Customer created", entity: "CUSTOMER" },
  { value: "customer.updated", label: "Customer updated", entity: "CUSTOMER" },
] as const;

export type TriggerType = (typeof AUTOMATION_TRIGGERS)[number]["value"];

/** The trigger → entity map, derived from the catalog (single source of truth). */
export const TRIGGER_ENTITY: Record<TriggerType, AutomationEntityType> =
  Object.fromEntries(
    AUTOMATION_TRIGGERS.map((t) => [t.value, t.entity]),
  ) as Record<TriggerType, AutomationEntityType>;

/** Whether a trigger fires proactively (time-based) vs from a live business event. */
export const TIME_BASED_TRIGGERS: readonly TriggerType[] = ["invoice.overdue"];

/** The closed set of condition operators. */
export const CONDITION_OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "does not equal" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is greater than or equal to" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is less than or equal to" },
  { value: "contains", label: "contains" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]["value"];

/** Operators that ignore the `value` field (unary). */
export const UNARY_OPERATORS: readonly ConditionOperator[] = ["is_empty", "is_not_empty"];

/** The closed set of action types. */
export const ACTION_TYPES = [
  { value: "send_notification", label: "Send in-app notification" },
  { value: "send_email", label: "Send templated email" },
  { value: "create_task", label: "Create a task" },
  { value: "log_activity", label: "Add a timeline note" },
] as const;

export type ActionType = (typeof ACTION_TYPES)[number]["value"];

/** Notification priority a `send_notification` action may set. */
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH";

/** Which internal role a `send_notification` targets. */
export type NotifyRole = "OWNER" | "STAFF";

/**
 * The whitelist of condition fields per entity. This is both the RuleBuilder's
 * field dropdown and the runtime evaluable surface — a condition naming a field
 * outside this set evaluates against `undefined` and simply fails to match
 * (never an error, never a leak of an un-whitelisted column).
 */
export type ConditionFieldKind = "string" | "number" | "date";

export const CONDITION_FIELDS: Record<
  AutomationEntityType,
  { value: string; label: string; kind: ConditionFieldKind }[]
> = {
  LEAD: [
    { value: "status", label: "Status", kind: "string" },
    { value: "name", label: "Name", kind: "string" },
    { value: "email", label: "Email", kind: "string" },
    { value: "sourceId", label: "Source", kind: "string" },
    { value: "assignedToId", label: "Assigned to", kind: "string" },
  ],
  QUOTE: [
    { value: "status", label: "Status", kind: "string" },
    { value: "total", label: "Total", kind: "number" },
    { value: "version", label: "Version", kind: "number" },
    { value: "currency", label: "Currency", kind: "string" },
  ],
  JOB: [
    { value: "status", label: "Status", kind: "string" },
    { value: "assignedToId", label: "Assigned technician", kind: "string" },
    { value: "scheduledDate", label: "Scheduled date", kind: "date" },
  ],
  INVOICE: [
    { value: "status", label: "Status", kind: "string" },
    { value: "amount", label: "Amount", kind: "number" },
    { value: "paidAmount", label: "Paid amount", kind: "number" },
    { value: "balance", label: "Balance due", kind: "number" },
  ],
  CUSTOMER: [
    { value: "type", label: "Type", kind: "string" },
    { value: "name", label: "Name", kind: "string" },
    { value: "email", label: "Email", kind: "string" },
    { value: "phone", label: "Phone", kind: "string" },
  ],
};

/**
 * The templates a `send_email` action may dispatch, per entity. These are
 * exactly the entity-derived, re-renderable templates the Email System already
 * ships (§11) — automation only *sequences* an existing template send, it never
 * composes new email content (§15.6, "thin wrapper over an existing service").
 */
export const EMAIL_TEMPLATE_CHOICES: Record<
  AutomationEntityType,
  { value: string; label: string }[]
> = {
  LEAD: [],
  QUOTE: [
    { value: "quote_shared", label: "Quote shared" },
    { value: "quote_accepted", label: "Quote accepted" },
    { value: "quote_declined", label: "Quote declined" },
  ],
  JOB: [
    { value: "job_scheduled", label: "Job scheduled" },
    { value: "job_completed", label: "Job completed" },
  ],
  INVOICE: [
    { value: "invoice_issued", label: "Invoice issued" },
    { value: "payment_received", label: "Payment received" },
  ],
  CUSTOMER: [],
};

/** Every email template an action may name, flattened (validation allow-list). */
export const AUTOMATION_EMAIL_TEMPLATES = Array.from(
  new Set(
    Object.values(EMAIL_TEMPLATE_CHOICES).flatMap((choices) =>
      choices.map((c) => c.value),
    ),
  ),
);

// --- Rule config shapes (mirror the Zod schemas in validation.ts) -----------

export type AutomationCondition = {
  field: string;
  op: ConditionOperator;
  value: string;
};

// Fields with a schema default (priority, role) are required here to match the
// validated OUTPUT shape (`z.infer`) the engine and actions pass around.
export type AutomationAction =
  | {
      type: "send_notification";
      title: string;
      body?: string;
      priority: NotificationPriority;
      role: NotifyRole;
    }
  | { type: "send_email"; template: string }
  | { type: "create_task"; title: string; dueInDays?: number }
  | { type: "log_activity"; message: string };

/** The status strings written to `AutomationLog.status`. */
export type AutomationRunStatus = "SUCCESS" | "FAILED" | "SKIPPED";
