# QuoteFlow — Phase 6B Step 6 Implementation Report
## Workflow Automation Engine

---

## 1. Executive Summary

Phase 6B **Step 6** delivers QuoteFlow's production-ready **Workflow Automation Engine** — a configurable, Owner-editable trigger/condition/action framework that becomes the platform's orchestration layer. Business events now flow through the Phase 6A **Event Bus**; the automation engine **subscribes** to those events and, for each matching rule, evaluates conditions against a server-authoritative snapshot of the triggering entity and executes an ordered set of actions. Every action is a thin call to a service that already exists (Email System, Notification producer, Activity writer, Task writer) — **the engine sequences existing logic, it never re-implements it.**

The milestone is **additive, backward compatible, and adds zero dependencies**. The `AutomationRule` / `AutomationLog` tables and the repository layer already existed from Step 1; Step 6 supersedes the deliberately-loose Step 1 validation placeholder with the **closed condition/action schema** it always anticipated, and wires the engine end-to-end. All four verification gates pass with **zero regressions** (486 tests, up from 465).

---

## 2. Objectives Completed

- **Configurable engine** — workflow definitions, closed-schema validation, trigger registration, an event-driven dispatcher, ordered action execution, an execution context, execution history, per-execution logging, per-action failure isolation, and non-blocking background execution semantics.
- **Event Bus integration** — business modules **publish** domain events exactly once (additive one-liners); the engine **subscribes** and translates each event to a `fireTrigger(...)`. Business modules never import or invoke the engine — complete separation.
- **13 triggers** across Leads, Quotes, Jobs, Invoices, Payments, Customers, including the one time-based trigger (`invoice.overdue`) fired lazily on read.
- **4 action types** — `send_email` (via `sendTemplatedEmail()`), `send_notification`, `create_task`, `log_activity` — each a wrapper over an existing service.
- **Admin UI** — rules list, rule detail/editor (RuleBuilder), enable/disable, and read-only execution history, under Settings → Automations (OWNER only).
- **Security** — org isolation, OWNER-only management, server-authoritative execution, IDOR-guarded history reads, closed-schema (no code-injection) rules, and audit logging.
- **All verification gates pass.**

---

## 3. Architecture

### 3.1 Event-mediated, not action-coupled
The approved architecture (§15.6) sketches `fireTrigger()` called inline from each business action. This milestone realises the **stronger, decoupled design that Phase 6A explicitly built the Event Bus for** ("the first consumer is the Automation engine's `fireTrigger`"): business actions publish a typed domain event and know nothing about automation; the engine subscribes. This satisfies the milestone's Event-Bus requirements verbatim — *"business modules should publish domain events exactly once; the workflow engine subscribes; business modules must never directly execute workflow logic; maintain complete separation"* — and keeps a single vocabulary across the bus, automation, and (future) webhooks.

### 3.2 Data flow
```
Business action (acceptQuote, recordPayment, …)
  → emitEvent("quote.accepted", { organizationId, quoteId })     // publish once, non-blocking
     → EventBus fan-out (failure-isolated)
        → automation subscriber → fireTrigger("quote.accepted", quoteId, org)
           → getRulesForTrigger(org, "quote.accepted")           // indexed; [] ⇒ done
           → loadEntitySnapshot(QUOTE, quoteId, org)             // server-authoritative
           → per rule: evaluateConditions() → runAction()×N → AutomationLog row
```
Time-based `invoice.overdue` fires from the Invoices list read path (`fireOverdueOnRead`), gated to once/day per (rule, invoice).

### 3.3 Registration
`instrumentation.ts` calls `registerAutomationSubscribers()` once per server instance (Node runtime only), before any request is served, so subscribers are listening when the first event publishes. Registration is idempotent.

### 3.4 Safety by construction
- **No code-injection surface (§15.9):** conditions/actions are validated against a **closed** Zod schema — a fixed operator set and a fixed discriminated union of action types. Unknown triggers/operators/action types are rejected at the boundary and re-checked at execution.
- **No infinite trigger chains:** the closed action set (`send_email`, `send_notification`, `create_task`, `log_activity`) contains nothing that publishes a domain event, so a rule firing can never re-enter the engine — loop-freedom is structural, not a runtime depth counter.
- **No rollback of business logic (§15.10):** actions are caught per-action; a failure is logged and its siblings still run; `fireTrigger` never throws.

---

## 4. Components Implemented

| Component | Responsibility |
|-----------|----------------|
| `types.ts` | Closed catalog: 13 triggers, 9 operators, 4 action types, per-entity condition-field & email-template whitelists. Client-safe. |
| `validation.ts` | Closed Zod schema (`createAutomationRuleSchema`, `ruleConfigSchema`) — supersedes the Step 1 placeholder. |
| `conditions.ts` | Pure, dependency-free `evaluateConditions()` — every operator, AND-combined, unit-tested. |
| `entity-fields.ts` | Server-authoritative entity snapshot loaders + system-actor resolution. |
| `engine.ts` | `runAction` dispatch, `fireTrigger`, `fireOverdueOnRead`, per-rule logging, once/day guard. |
| `subscribers.ts` | `registerAutomationSubscribers()` — event → `fireTrigger` mapping (idempotent). |
| `repository.ts` | (Step 1, extended) rule CRUD + `getRulesForTrigger` + `AutomationLog` writes/lookups. |
| `actions.ts` | OWNER-gated `createRule` / `updateRule` / `toggleRule`. No rule-execution action exists by design. |
| `queries.ts` | OWNER-scoped list / detail / history reads (IDOR-guarded). |
| `labels.ts` | Client-safe display labels + status colors. |
| `components/` | `RuleList`, `RuleBuilder`, `RuleToggle`, `AutomationLogTable`. |

---

## 5. Files Created

```
src/instrumentation.ts
src/features/automation/types.ts
src/features/automation/conditions.ts
src/features/automation/entity-fields.ts
src/features/automation/engine.ts
src/features/automation/subscribers.ts
src/features/automation/actions.ts
src/features/automation/queries.ts
src/features/automation/labels.ts
src/features/automation/components/RuleList.tsx
src/features/automation/components/RuleBuilder.tsx
src/features/automation/components/RuleToggle.tsx
src/features/automation/components/AutomationLogTable.tsx
src/app/(dashboard)/settings/automations/page.tsx
src/app/(dashboard)/settings/automations/new/page.tsx
src/app/(dashboard)/settings/automations/[id]/page.tsx
src/features/automation/conditions.test.ts
src/features/automation/engine.test.ts
src/features/automation/subscribers.test.ts
docs/QuoteFlow_Phase6B_Step6_Implementation_Report.md
```

## 6. Files Modified

```
src/features/automation/validation.ts          # closed schema supersedes Step 1 placeholder
src/features/automation/repository.ts           # derive triggerEntity from trigger
src/features/automation/validation.test.ts      # rewritten for the closed schema
src/lib/events/types.ts                          # +4 additive events (lead.converted, quote.created, customer.created/updated)
src/features/quotes/actions.ts                   # emit quote.created/sent/accepted/declined
src/features/invoices/actions.ts                 # emit invoice.created + payment.recorded (thread payment id)
src/features/jobs/actions.ts                     # emit job.scheduled/completed
src/features/leads/actions.ts                    # emit lead.created + lead.converted (on WON)
src/features/customers/actions.ts                # emit customer.created/updated
src/features/invoices/queries.ts                 # fireOverdueOnRead (time-based, once/day)
src/features/settings/components/SettingsNav.tsx # "Automations" nav entry (OWNER)
```

## 7. Packages Installed

**None.** The engine reuses the Event Bus, Job-queue abstractions, Provider Registry, Email System, Document Engine, Notification/Activity/Task services, and the existing `AutomationRule`/`AutomationLog` schema. Zero new dependencies, zero schema changes, zero migration.

## 8. Commands Executed

```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest run
npm run build       # next build
```

## 9. Testing Results

| Gate | Result |
|------|--------|
| `tsc --noEmit` | ✅ 0 errors |
| `eslint` | ✅ 0 errors / 0 warnings |
| `vitest run` | ✅ **82 files / 486 tests** passed (was 79 / 465 → **+3 files / +21 tests**, zero regressions) |
| `next build` | ✅ Compiled successfully; `/settings/automations`, `/settings/automations/new`, `/settings/automations/[id]` generated |

New/updated tests:
- `conditions.test.ts` — every operator (eq/neq/gt/gte/lt/lte/contains/is_empty/is_not_empty), numeric & ISO-date ordering, AND-combining, unknown-field-never-matches.
- `validation.test.ts` (rewritten) — rejects unknown trigger / operator / action type / email template; requires ≥1 action; defaults applied (§15.9).
- `engine.test.ts` — SUCCESS path; **SKIPPED logs but performs zero actions, every time** (§15.12); **a failing action doesn't block its siblings and the rule is logged FAILED** (§15.10); `fireTrigger` never throws; no-rules ⇒ no snapshot load.
- `subscribers.test.ts` — event → `fireTrigger` mapping (incl. payment.recorded firing against the invoice); registration idempotency.

## 10. Problems Encountered

1. **Step 1 placeholder vs closed schema.** The automation folder already held a loose Step 1 validation/repository/test (explicitly deferring "the vocabulary the engine will define"). Resolved by superseding `validation.ts` with the closed schema while keeping the export names the repository depends on, deriving `triggerEntity` from the trigger in the repository, and rewriting the placeholder test.
2. **Zod enum widening.** `z.enum(arr as [string, ...string[]])` inferred `op: string`, breaking the pure evaluator's typed switch. Fixed by casting the value arrays to literal tuples (`[ConditionOperator, ...]`, `[TriggerType, ...]`) so `z.infer` yields the precise unions.
3. **Defaulted-field optionality.** Schema `.default()` makes a field required on the validated OUTPUT but the hand-written `AutomationAction` had them optional, so the RuleBuilder payload wasn't assignable to the action input. Aligned `AutomationAction` (priority/role required) to the `z.infer` output shape.

## 11. Architecture Compliance

- **§15.2 / §15.7** — event-driven and time-based triggers; conditions evaluated against a server-authoritative entity snapshot; actions run in order; every firing logged. ✔
- **§15.6** — `runAction` dispatches to exactly `send_email` / `send_notification` / `create_task` / `log_activity`, each a thin wrapper over an existing service; **zero duplicated business logic**. ✔
- **§15.8** — rule management is OWNER-only; rule *execution* has no user-facing permission check and runs server-authoritatively (there is **no** client-callable "run a rule" surface). ✔
- **§15.9** — conditions/actions are closed, schema-validated JSON; never `eval`'d; re-parsed at execution. ✔
- **§15.10** — per-action isolation; automation failures never roll back the triggering transaction; `fireTrigger` never throws. ✔
- **§15.11** — hot lookup on the `(organizationId, triggerType, isActive)` index; time-based guard is a single indexed `AutomationLog` read; the common no-rule case costs one indexed query. ✔
- **§6 / Event Bus** — business modules publish exactly once; the engine subscribes; complete separation. ✔
- **Reuse** — Email System (`sendTemplatedEmail`, `rebuildEmailJob`), Document Engine (via the email attachments path), Notification/Activity/Task writers, Provider Registry (bus/queue), Company Config, Decimal money, org isolation, optimistic concurrency — all reused, none duplicated. ✔
- **Performance** — no duplicate executions (once/day guard on time-based; event-driven fires once per event), no recursive loops (closed non-triggering action set), no N+1 on rule lookups. ✔
- **Scope discipline** — no Public API, no AI, no Integrations, no cron runner; additive & backward compatible; no new packages; no schema change. ✔

## 12. Recommended Next Milestone

**Phase 6B — Step 7: Public API & Webhooks (§21).** The Event Bus already in place is the second consumer's foundation (`dispatchWebhooks` subscribing to the same taxonomy, §21.7), and `WebhookDelivery` + the Job-queue retry abstractions are already provisioned. A closely-related fundable enabler is a **cron runner** (Vercel Cron), which would let the time-based `invoice.overdue` (and future lead-inactivity) triggers, plus email retry, fire *proactively* rather than lazily on read — a single scheduled route calling `fireTrigger()`, with zero change to the engine (§15.13).

---

*Phase 6B Step 6 complete. Stop condition met — awaiting approval before Step 7.*
