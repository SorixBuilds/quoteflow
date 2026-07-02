# QuoteFlow — Phase 6B Step 8 Implementation Report

## Public API Write Endpoints, Webhooks & Integration Framework

**Status:** ✅ Complete · **Date:** 2026-07-02 · **Scope:** Phase 6B Step 8 only (no AI, no live third-party integrations, no cron runner, no future milestone).

---

## 1. Executive Summary

Step 8 completes the Public API and opens QuoteFlow to external systems, in three architecture-mandated pieces:

1. **Write endpoints (§21.6, §29 "Step 13")** — `POST /api/v1/leads`, `POST /api/v1/customers`, `PATCH /api/v1/customers/{id}`, and `POST /api/v1/quotes` (§21.12's named equivalence surface). Each calls **the same business-core function the staff UI calls** — achieved by extracting each Phase 5 action's body into a session-free `features/<entity>/service.ts` core taking an explicit `ActorScope { organizationId, actorId }`. The server action and the API handler are now two thin front doors (staff session vs. API key) onto one implementation. The equivalence is **CI-enforced** by a static import-graph test plus behavioral service/route tests.
2. **Outbound webhooks (§21.7)** — `dispatchWebhooks()`, the event bus's designed second consumer (registered in `instrumentation.ts` beside Step 6's automation subscribers — "same event taxonomy, two consumers"). Every domain event fans out to the org's active, subscribed webhooks: one `WebhookDelivery` row per target, an HMAC-SHA256-signed POST (`X-QuoteFlow-Signature: t=…,v1=…`, Stripe-style timestamped signing), and on failure a capped exponential-backoff retry (5 attempts, the shared `lib/jobs` policy — the same §11.10 shape as email retry), drained lazily on platform activity with `processDueWebhookDeliveries()` exported for the future cron runner.
3. **Integration Framework surface (§20, §29 "Step 11")** — `connectIntegration`/`disconnectIntegration` actions over the Phase 6A registry, the `IntegrationCard` component, and the **Settings → Integrations** screen hosting integration cards (empty in Phase 6 by design — zero live integrations, per §5 Non-Goals) alongside the new webhook management UI (§21.5's placement).

**Zero new dependencies. Zero schema changes.** The `Webhook`/`WebhookDelivery`/`Integration` tables, webhook repository/validation, integration registry, retry math, and event bus all existed from Steps 1/6A — Step 8 is the consumer they were built for.

## 2. Objectives Completed

- ✅ Session-free business cores for customers (create/update), leads (create), quotes (create) — extracted verbatim from the frozen Phase 5 action bodies, with two §22.3 tightenings (see §10.3).
- ✅ Four write endpoints calling those cores under write scopes, with `201` envelopes, shared-schema body validation (`400 invalid_json` / `422 validation_error`), and `BusinessRuleError → 422 business_rule_violation` mapping in the one shared wrapper.
- ✅ API caller identity: `ApiKeyContext.actorId` = the key's creator — Activity and notifications attribute machine writes to the OWNER who delegated the access.
- ✅ Webhook dispatch: fan-out, per-delivery record, deterministic signed body (identical bytes on retry), 10 s timeout, SUCCESS/FAILED + `nextRetryAt` backoff, terminal at 5 attempts, lazy due-delivery drain; never throws into the publishing action.
- ✅ HMAC signing + receiver-side verification helpers (timestamped, constant-time compare, replay tolerance) — the §21.9 discipline, unit-tested.
- ✅ Webhook management (§21.5): OWNER create (https-only URL, explicit event subset from the closed 16-event taxonomy, one-time signing secret display), enable/disable, delete (atomic with delivery history), recent-delivery status per webhook.
- ✅ Integration lifecycle (§20.6–20.10): OWNER-gated connect/disconnect, unknown-provider graceful failure, `NOT_CONNECTED → CONNECTED → ERROR` statuses, Settings → Integrations screen listing registered providers (none yet, by design).
- ✅ All management writes audit-logged to Activity; documentation updated; all four gates green.

## 3. Architecture

### 3.1 One implementation, two front doors (§21.6, §21.12)

```
Staff UI  → server action:  requireRole/requireCompanyScope → schema.parse ─┐
                                                                            ├→ features/<entity>/service.ts core({organizationId, actorId}, data)
API caller → route handler: requireApiKey(scope) → parseJsonBody(schema) ──┘        row + Activity + notifications + domain event
```

The core never reads a session or a key (§22.1 planes stay disjoint); each front door resolves an `ActorScope` its own way. UI-plane concerns (`revalidatePath`, `ActionResult` envelopes) stay in the action; wire-plane concerns (status codes, error envelope) stay in the handler. `updateQuote` (a staff-only surface) keeps using the same shared `resolveLines`/`parseDiscount` helpers from the service module — no duplication anywhere.

**Reconciliation note:** §21.6 says write endpoints call "the same `features/<entity>/actions.ts` functions." A `"use server"` file may only export server actions, and the Phase 5 actions were session-bound inside — so the shared function's *home* is `service.ts`, with `actions.ts` re-composed on top of it. Same function object, verified by the equivalence test; the alternative (a second implementation in the API) is exactly what §21.6 forbids.

### 3.2 Webhooks: the taxonomy's second consumer (§21.7)

Business modules still publish each domain event exactly once. `registerWebhookSubscribers()` (idempotent, `instrumentation.ts`, Node-runtime-guarded) subscribes to all 16 events — the catalog in `features/webhooks/events.ts` is a `Record<DomainEventName, true>`, so taxonomy coverage is a **compile-time** guarantee. Payloads carry entity ids, not entity state; a receiver fetches current state through the read API (server-authoritative, same §15.7 principle as automation snapshots).

Delivery is deliberately at-least-once: `X-QuoteFlow-Delivery` is the dedupe key, documented for integrators. No delivery can re-enter the platform (an outbound POST publishes nothing), so webhook loops are impossible by construction — the same §15.10 reasoning as automation.

### 3.3 Retry without a cron (§21.7 ↔ §11.10)

Attempt 1 fires inline at dispatch (fire-and-forget relative to the business action, per §23). Failures schedule `nextRetryAt` from the shared `computeBackoffMs` (1 s base, ×2, 5 min cap) and are re-attempted by a bounded lazy drain piggybacked on subsequent dispatches — the same no-cron posture as email retry and `invoice.overdue`. Terminal = 5 attempts (`shouldRetry`), excluded from the drain query so dead rows never occupy a batch. `processDueWebhookDeliveries()` is the ready-made entry point for the §15.13 cron enabler, which now serves three surfaces (email retry, time-based automation, webhook retry).

### 3.4 Integration framework: complete lifecycle, zero connections (§20)

The Settings → Integrations screen renders every *registered* provider with Connect/Disconnect per §20.5–20.7 — and the registry is empty per §5, so the screen honestly shows the framework's readiness. `connectIntegration` returns a typed failure for an unknown key (§20.10 — today, every key), enforces OWNER (§20.8), and persists only non-secret `config` metadata (§20.9's binding credential rule, restated at every layer). A future adapter is one file + one registry entry; nothing in this step changes.

## 4. Components Implemented

| Component | File(s) | §Ref |
|---|---|---|
| `ActorScope` caller-identity type | `src/types/index.ts` (additive) | 21.6, 22.1 |
| Customer core (create/update) | `src/features/customers/service.ts` (+ slimmed `actions.ts`) | 21.6 |
| Lead core (create, org-checked refs, session-free notify) | `src/features/leads/service.ts` (+ slimmed `actions.ts`) | 21.6, 22.3 |
| Quote core (create; shared `resolveLines`/`parseDiscount`) | `src/features/quotes/service.ts` (+ slimmed `actions.ts`) | 21.6, 21.12 |
| Write handlers | `POST v1/leads`, `POST v1/customers`, `PATCH v1/customers/[id]`, `POST v1/quotes` | 21.6 |
| Body parsing + 201 envelope + BusinessRuleError→422 | `src/lib/api/params.ts`, `src/lib/api/error.ts` (additive) | 21.10 |
| API actor identity | `src/lib/api/auth.ts` (`actorId`, additive) | 21.6 |
| Event catalog (compile-checked coverage) | `src/features/webhooks/events.ts` | 21.7 |
| HMAC signing + verification | `src/features/webhooks/sign.ts` | 21.9 |
| Dispatcher + lazy retry drain | `src/features/webhooks/dispatch.ts` | 21.7 |
| Bus subscriber + boot registration | `src/features/webhooks/subscribers.ts`, `src/instrumentation.ts` | 21.7 |
| Webhook management | `src/features/webhooks/actions.ts`, `queries.ts`, `components/WebhooksManager.tsx` | 21.5 |
| Integration lifecycle + UI | `src/features/integrations/actions.ts`, `queries.ts`, `components/IntegrationCard.tsx` | 20.5–20.10 |
| Settings → Integrations page + nav | `src/app/(dashboard)/settings/integrations/page.tsx`, `SettingsNav.tsx` | 20.5, 21.5 |

## 5. Files Created

`src/features/customers/service.ts` · `src/features/leads/service.ts` · `src/features/quotes/service.ts` · `src/features/webhooks/events.ts` · `src/features/webhooks/sign.ts` · `src/features/webhooks/dispatch.ts` · `src/features/webhooks/subscribers.ts` · `src/features/webhooks/actions.ts` · `src/features/webhooks/queries.ts` · `src/features/webhooks/components/WebhooksManager.tsx` · `src/features/integrations/actions.ts` · `src/features/integrations/queries.ts` · `src/features/integrations/components/IntegrationCard.tsx` · `src/app/(dashboard)/settings/integrations/page.tsx`

**Tests (7):** `src/features/webhooks/sign.test.ts` · `src/features/webhooks/dispatch.test.ts` · `src/features/webhooks/subscribers.test.ts` · `src/features/customers/service.test.ts` · `src/features/integrations/actions.test.ts` · `src/lib/api/equivalence.test.ts` · `src/app/api/v1/customers/route.test.ts`

**Docs:** this report; `docs/QuoteFlow_Public_API_v1.md` extended (write endpoints, error codes, full Webhooks section with signature-verification guidance).

## 6. Files Modified

- `src/features/customers/actions.ts`, `src/features/leads/actions.ts`, `src/features/quotes/actions.ts` — bodies re-composed onto the shared cores (behavior preserved; unused imports pruned).
- `src/app/api/v1/{leads,customers,quotes}/route.ts`, `src/app/api/v1/customers/[id]/route.ts` — POST/PATCH handlers added.
- `src/lib/api/auth.ts` (`actorId`), `src/lib/api/params.ts` (`parseJsonBody`, `createdResponse`), `src/lib/api/error.ts` (BusinessRuleError mapping) — additive.
- `src/features/webhooks/repository.ts` — additive `findWebhookForDispatch`/`listDeliveriesForWebhook`; `listDueDeliveries` gains a `maxAttempts` exclusion; `deleteWebhook` made atomic over delivery history (the FK carries no cascade).
- `src/instrumentation.ts` — webhook subscriber registration added beside automation's.
- `src/features/settings/components/SettingsNav.tsx` — "Integrations" tab (OWNER).
- `src/features/api-keys/components/ApiKeysManager.tsx` — one comment updated (`webhooks:manage` reservation rationale).
- `src/types/index.ts` — `ActorScope` added.

No frozen Phase 1–5 behavior changed: the action extractions preserve every write, Activity record, notification, and event (verified by the unchanged existing test suite), with the two documented §22.3 tightenings below.

## 7. Packages Installed

**None.** HMAC is `node:crypto`; retry math is `lib/jobs`; everything else was already in the tree.

## 8. Commands Executed

```
npx tsc --noEmit          # typecheck gate
npm run lint              # ESLint gate
npx vitest run            # test gate
npm run build             # Next.js production build gate
```

## 9. Testing Results

| Gate | Result |
|---|---|
| TypeScript | ✅ 0 errors |
| ESLint | ✅ 0 errors / 0 warnings |
| Vitest | ✅ **95 files / 555 tests passed** (Step 7 baseline: 88/521 → **+7 files / +34 tests**, zero regressions, none skipped) |
| Next build | ✅ Compiled; `/settings/integrations` + all v1 routes generated |

New coverage (§21.12, §20.12): HMAC signature correctness/tamper/replay-window/malformed-header; dispatch fan-out, signed-and-verifiable wire payload, SUCCESS/FAILED transitions, backoff scheduling, 5-attempt terminal cap, inactive-webhook skip, never-throws (even on repository failure); subscriber wiring across the taxonomy + idempotent registration + compile-checked 16-event coverage; the **equivalence test** (both front doors import the same core from the same service module, same schema module — per entity); write-handler wiring (scope, tenant+actor into the core, 422/400/business-rule envelopes, no DB touch on bad input); customer core behavior (identical row/Activity/event for any caller); integration unknown-provider graceful failure + OWNER gate.

## 10. Problems Encountered

1. **`"use server"` export constraint vs. §21.6's "same function".** A server-action file cannot export a plain shared function, and the Phase 5 actions read the session mid-body. Resolved by the `service.ts` extraction (§3.1) — the architecture's intent (one implementation) preserved exactly, with the mechanics documented rather than silently bent.
2. **TypeScript correlation in the generic subscriber loop.** Subscribing all 16 events in a loop broke payload-type correlation (interfaces have no implicit index signature). Making `dispatchWebhooks` generic over `DomainEventName` restored inference for both the loop and literal call sites.
3. **§22.3 tightenings surfaced by the new hostile-input surface (deliberate, documented):** `createLeadCore` now verifies `sourceId`/`assignedToId` belong to the organization, and `createQuoteCore` verifies `leadId` does — the staff UI only ever offered in-org values, so internal behavior is unchanged, but a malicious API body can no longer store a cross-tenant reference.
4. **`WebhookDelivery` FK has no cascade** (§7.2.4 as frozen) — deleting a webhook with history would violate the constraint. `deleteWebhook` now removes delivery rows in the same transaction, keeping the schema untouched.
5. **Terminal deliveries vs. the drain query.** `listDueDeliveries` treated `nextRetryAt: null` as "due now", which would re-fetch exhausted deliveries forever; it now excludes rows at the attempt cap.

## 11. Architecture Compliance

- ✅ **Zero duplicated business logic** — the one rule this step existed to prove: write endpoints share the internal implementation, CI-enforced (§21.6/§21.12/§25).
- ✅ Event integration: publish-once unchanged; the dispatcher is a subscriber, business modules never call it (§21.7); no recursive loops possible.
- ✅ Retry behavior on the shared `lib/jobs` policy — no hand-rolled backoff (§11.10/§21.7); fire-and-forget relative to the triggering action (§23).
- ✅ Security: three planes still disjoint (import-boundary tests pass untouched); webhook secrets shown once, never re-read (§22.2); https-only targets; signed payloads; org isolation on every new query; IDOR-guarded delivery history; no-enumeration posture carried into write errors; audit logging on every management write (§22).
- ✅ Integration framework: OWNER-only, graceful unknown-provider failure, non-secret `config` only, zero live integrations (§20, §5).
- ✅ Additive & backward compatible; zero deps; zero schema; no TODOs; no dead code (every new function has a live consumer or is the documented cron entry point named by the architecture).

**Deliberate deferrals (named):** `jobs:write`/`invoices:write` endpoints (jobs/invoices are created by QuoteFlow's own quote-acceptance workflow; no §21 design exists for external creation), API-managed webhook CRUD under `webhooks:manage` (webhooks are UI-managed per §21.5; the scope stays reserved), and the cron runner (§15.13 funding trigger — now the enabler for email retry, time-based automation, *and* webhook retry).

## 12. Recommended Next Milestone

**Phase 6B Step 9 — AI Platform (§16, §29 "Step 14"):** the `AIProvider` interface + `NullAIProvider`, `AiUsageLog` persistence (table already shipped in Step 1), the `aiEnabled` feature-flag gate (defaulting off for every organization), and the initially-invisible `AiSuggestButton`/`AiDraftPanel` components — provider-agnostic, zero-cost until a real key is configured.

---

*Phase 6B Step 8 is complete and frozen pending approval. No further milestone has been started.*
