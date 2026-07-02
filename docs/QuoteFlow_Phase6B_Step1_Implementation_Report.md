# QuoteFlow — Phase 6B Step 1 Implementation Report
## Infrastructure Schema & Persistence

| | |
|---|---|
| **Milestone** | Phase 6B — Step 1 (Infrastructure Schema & Persistence) |
| **Status** | ✅ Complete — all verification gates pass |
| **Date** | 2026-06-28 |
| **Authority** | `QuoteFlow_Phase6_Advanced_Platform_Architecture.md` §7.2 (the document's complete and exhaustive list of new persistence), §29 Step 1 |
| **Scope rule** | Persistence layer only — no business workflows, no UI |

---

## 1. Executive Summary

Step 1 introduces the **complete database layer** that every remaining Phase 6 milestone (Steps 2–14) will consume, and nothing more. It implements the exhaustive `§7.2` schema — 10 new tables and 2 new nullable columns — as a single additive, backwards-compatible, production-safe Prisma migration, then layers a typed, organization-scoped **repository** and **Zod validation** surface over every new entity, plus the **security primitives** (hashed API keys, hashed portal tokens, CSPRNG signing secrets) the architecture mandates.

No business workflow, server action, or UI was built — those belong to Steps 2–14. No package was installed. The frozen Phase 1–5 surface is untouched apart from the two §7.2-approved nullable columns and the unavoidable additive relation fields Prisma requires on the parent side of each new foreign key.

All nine self-validation gates pass: schema validates, migration applied cleanly to the live Neon database, existing rows remain compatible, typecheck/lint/build are clean, and the test suite is green at **321 tests across 56 files** (up from 280/45 at the end of Phase 6A — +41 tests, +11 files, zero regressions).

---

## 2. Objectives Completed

- ✅ Every §7.2 persistence object implemented — 10 models, 2 columns, all relations/indexes/constraints. None omitted.
- ✅ One additive Prisma migration generated and applied; verified additive-only (no DROP/DELETE/ALTER COLUMN/backfill).
- ✅ A typed repository per entity (data-access only), organization-scoped via an `organizationId` argument the caller derives from `requireCompanyScope()`.
- ✅ Zod validation schemas + reusable validators for every entity carrying externally-influenced input.
- ✅ Security implemented for real (no placeholders): bcrypt-hashed API keys & portal tokens, CSPRNG webhook signing secrets, http(s)-scheme guards, least-privilege scope enforcement, §20.9 credential boundary.
- ✅ Single tenancy model reused (`organizationId` row scoping) — no second model introduced.
- ✅ Existing Phase 6A provider registry reused; no new configuration framework.
- ✅ Zero new packages.
- ✅ All verification gates pass.

---

## 3. Database Models Added (10)

| # | Model | §7.2 | Purpose |
|---|---|---|---|
| 1 | `EmailLog` | 7.2.1 | Source of truth for every attempted email + its terminal status |
| 2 | `FileAttachment` | 7.2.2 | Polymorphic file/media attachments (URL-paste today, Blob later) |
| 3 | `ApiKey` | 7.2.3 | Public-API credential — bcrypt-hashed, prefix-indexed, scoped |
| 4 | `Webhook` | 7.2.4 | Outbound webhook subscription + HMAC signing secret |
| 5 | `WebhookDelivery` | 7.2.4 | Per-attempt delivery record backing the retry policy |
| 6 | `AutomationRule` | 7.2.5 | Trigger/condition/action rule definition |
| 7 | `AutomationLog` | 7.2.5 | Per-execution audit row |
| 8 | `Integration` | 7.2.6 | Third-party connection record (non-secret config only) |
| 9 | `PortalAccessToken` | 7.2.7 | Stored, revocable Customer Portal token — bcrypt-hashed |
| 10 | `AiUsageLog` | 7.2.8 | AI cost/usage ledger (written even by the null provider) |

> **Note on the "nine tables" prose.** The §7.2 narrative says "nine new tables"; the exhaustive model list in §7.2.1–7.2.8 defines **ten** (the prose appears to merge `Webhook`/`WebhookDelivery` or `AutomationRule`/`AutomationLog`). Per the document's own instruction that §7.2 is "the complete list," the exhaustive list governs — all ten are implemented.

---

## 4. Enums Added

**None** — by design. §7.2 explicitly adds no new `EntityType` values and no new enums; the existing 6-value `EntityType` (`LEAD`/`QUOTE`/`JOB`/`CUSTOMER`/`INVOICE`/`ORGANIZATION`) covers every polymorphic reference. Open-ended taxonomies (`EmailLog.status`, `templateType`, `Integration.status`, `AutomationLog.status`, etc.) are stored as free-text strings, exactly as the frozen `Activity.type`/`Notification.type` precedent does, with the known value sets provided as TypeScript `const` tuples in the validation layer rather than as DB enums.

---

## 5. Relations Added

**New foreign-key relations (child → parent):**

- `EmailLog`, `FileAttachment`, `ApiKey`, `Webhook`, `AutomationRule`, `Integration`, `PortalAccessToken`, `AiUsageLog` → `Organization`
- `FileAttachment.uploadedBy`, `ApiKey.createdBy` → `User`
- `PortalAccessToken.customer` → `Customer`
- `WebhookDelivery.webhook` → `Webhook`
- `AutomationLog.rule` → `AutomationRule`

**Additive back-relation fields on frozen models (relation fields only — no columns, no constraints):**

- `Organization`: `emailLogs`, `fileAttachments`, `apiKeys`, `webhooks`, `automationRules`, `integrations`, `portalAccessTokens`, `aiUsageLogs`
- `User`: `fileAttachments`, `apiKeys`
- `Customer`: `portalAccessTokens`

These back-relations are **required by Prisma** on the parent side of every relation and are the only change to frozen Phase 2 entities other than the two §7.2-approved columns. They add no column, index, or constraint and are invisible at the SQL level.

---

## 6. Indexes Added (11)

| Model | Index |
|---|---|
| `EmailLog` | `(organizationId, status, createdAt)` |
| `EmailLog` | `(organizationId, relatedEntityType, relatedEntityId)` |
| `FileAttachment` | `(organizationId, entityType, entityId)` |
| `ApiKey` | `(organizationId, isActive)` |
| `Webhook` | `(organizationId, isActive)` |
| `WebhookDelivery` | `(webhookId, status, nextRetryAt)` |
| `AutomationRule` | `(organizationId, triggerType, isActive)` |
| `AutomationLog` | `(ruleId, executedAt)` |
| `PortalAccessToken` | `(organizationId, customerId)` |
| `AiUsageLog` | `(organizationId, createdAt)` |
| `Integration` | `(organizationId, provider)` **UNIQUE** |

Every index is exactly as specified in §7.2 and backs a hot read path named in the corresponding feature section (e.g. the `(organizationId, triggerType, isActive)` index backs the automation engine's trigger lookup, §15; `keyPrefix` + `(organizationId, isActive)` back the §21.6 API-key narrowing step).

---

## 7. Constraints Added

- **Foreign keys:** 13 (listed in §5), all `ON DELETE RESTRICT ON UPDATE CASCADE` — Prisma's default, consistent with the frozen schema's non-cascading FKs.
- **Unique:** `Integration(organizationId, provider)` — guarantees one connection row per provider per tenant, enabling the `upsert` re-connect pattern.
- **Native array columns:** `ApiKey.scopes` and `Webhook.subscribedEvents` (`String[]`) — the schema's first Postgres array columns, justified in §7.2.3 for indexable `has` membership tests.
- **Decimal:** `AiUsageLog.costEstimate` `@db.Decimal(10,4)` — money discipline (never `Float`), §5.

No `CHECK` constraints were added (none are specified; the app-layer Zod validation enforces the value sets).

---

## 8. Migrations Generated

**`prisma/migrations/20260628103421_phase6b_step1_infrastructure_persistence/migration.sql`**

*Why this migration is necessary:* Step 1's entire purpose is to introduce the §7.2 persistence layer; this is the single migration that creates it. It was generated by `prisma migrate dev` from the schema edits and applied to the live database in the same step.

**Verified additive / backwards-compatible / production-safe.** Statement census:

- `CREATE TABLE` × 10 (all new)
- `CREATE INDEX` × 10 + `CREATE UNIQUE INDEX` × 1
- `ALTER TABLE … ADD CONSTRAINT` × 13 (FKs on the new tables)
- `ALTER TABLE … ADD COLUMN` × 2 — `Job.scheduledEndAt` (nullable `TIMESTAMP(3)`) and `User.notificationPreferences` (nullable `JSONB`)
- **Zero** `DROP`, `DELETE`, `TRUNCATE`, `ALTER COLUMN`, or `NOT NULL`-without-default statements

Both new columns are nullable with no default, so existing rows take `NULL` (semantically "all notification channels enabled" / "point-in-time job") and **no backfill is required**. `prisma migrate status` confirms the database is in sync.

---

## 9. Repository Layer Created

One repository module per feature folder, encapsulating all database access for its entity (or entity pair). Pure persistence — no `"use server"`, no `revalidatePath`, no business rules, no activity logging. Every read/write is organization-scoped through an `organizationId` argument the caller supplies from `requireCompanyScope()`, mirroring the existing `features/notes/queries.ts` convention. Typed end-to-end against the generated Prisma models.

| Repository | Entity(ies) | Representative methods |
|---|---|---|
| `features/email/repository.ts` | `EmailLog` | `createEmailLog`, `updateEmailLogStatus`, `listEmailLogsForEntity`, `listEmailLogs` |
| `features/files/repository.ts` | `FileAttachment` | `createFileAttachment`, `listAttachmentsForEntity`, `deleteFileAttachment` |
| `features/api-keys/repository.ts` | `ApiKey` | `createApiKey` (returns one-time plaintext), `findActiveKeyCandidatesByPrefix`, `touchApiKeyLastUsed`, `revokeApiKey` |
| `features/webhooks/repository.ts` | `Webhook`, `WebhookDelivery` | `createWebhook`, `listActiveWebhooksForEvent`, `createWebhookDelivery`, `updateWebhookDelivery`, `listDueDeliveries` |
| `features/automation/repository.ts` | `AutomationRule`, `AutomationLog` | `createAutomationRule`, `getRulesForTrigger`, `createAutomationLog`, `getLastLogForRuleEntity` |
| `features/integrations/repository.ts` | `Integration` | `upsertIntegration`, `getIntegration`, `setIntegrationStatus`, `deleteIntegration` |
| `features/customer-portal/repository.ts` | `PortalAccessToken` | `issuePortalToken` (returns one-time plaintext), `listRedeemableTokens`, `markPortalTokenUsed`, `revokePortalToken` |
| `features/ai/repository.ts` | `AiUsageLog` | `recordAiUsage`, `listAiUsage`, `summarizeAiUsage` (aggregate) |

**Tenancy note:** the deliberate exception to org-scoping is `ApiKey.findActiveKeyCandidatesByPrefix`, which runs *before* the tenant is known (the key itself establishes the organization) — it narrows by the indexed `keyPrefix`, exactly as the authoritative §21.6 flow specifies.

---

## 10. Validation Layer

Per-feature `validation.ts` Zod schemas covering every entity with externally-influenced input, reusing the conventions in `lib/validation.ts` (decimal-as-string for money, never float):

- **api-keys** — scope subset of the fixed §21.8 list, ≥1 required (no all-by-default), de-duplicated.
- **files** — http(s)-scheme guard (rejects `javascript:`/`data:`/`file:`), fixed `category` set, `entityType`/`entityId` paired-or-neither rule.
- **webhooks** — https-only delivery target, ≥1 subscribed event, de-duplicated.
- **automation** — minimal structural shape (conditions object, ≥1 `{type, params}` action) without freezing the engine's future vocabulary.
- **integrations** — provider required; `config` typed as non-secret metadata (documents the §20.9 boundary).
- **email** — RFC email format on `to`/`from`, known status set.
- **ai** — 4dp decimal-string cost (never float), non-negative token count.
- **customer-portal** — uuid customer id, future-only expiry, optional label.

Known-value sets are exported as `const` tuples (`API_SCOPES`, `FILE_CATEGORIES`, `EMAIL_STATUSES`, `INTEGRATION_STATUSES`, `AUTOMATION_LOG_STATUSES`) for reuse by both the validators and later workflow steps.

---

## 11. Configuration Changes

**None.** No new environment variable, config key, or framework was introduced. The Phase 6A provider-selection env vars and the existing `lib/config` flag framework already cover Phase 6's configuration needs; Step 1 is pure persistence and required nothing further. Bcrypt cost reuses the existing `BCRYPT_COST_FACTOR`.

---

## 12. Security Measures

Implemented for real — no placeholders:

- **`lib/secrets.ts`** — single source of truth for secret generation/hashing: `generateSecretToken` (256-bit CSPRNG, base64url), `hashToken`/`verifyToken` (bcrypt at the shared cost factor). Mirrors the `lib/password.ts` discipline.
- **API keys (`features/api-keys/key.ts`)** — full key shown once, never stored; only the **bcrypt hash** + an indexed 11-char `keyPrefix` persist. Verification narrows by prefix (indexed) then constant-time bcrypt-compares — fast without ever storing the key in searchable plaintext (§21.9). Scopes enforce least privilege (§21.8).
- **Portal tokens (`features/customer-portal/token.ts`)** — same one-way-hash pattern; the stored, revocable token supports `revokedAt` + `expiresAt` and coexists with (never touches) the frozen Phase 5 HMAC quote-share link.
- **Webhook signing secret** — generated with the same CSPRNG; stored as issued (it must be recoverable to sign each outbound delivery), shown once. This is the deliberate counterpart to the one-way-hashed auth tokens, exactly as §7.2.4 distinguishes.
- **URL-scheme guards** — file URLs must be http(s); webhook URLs must be https — defense-in-depth at the persistence boundary alongside the Phase 6A `UrlPasteProvider`.
- **§20.9 credential boundary** — `Integration.config` is validated and documented as non-secret metadata only; credentials never pass through it.
- **Tenant isolation** — every repository read/write is organization-scoped (the one auth-time exception is documented in §9).

---

## 13. Files Created (29)

**Schema / migration (1)**
- `prisma/migrations/20260628103421_phase6b_step1_infrastructure_persistence/migration.sql`

**lib (2)**
- `src/lib/secrets.ts`, `src/lib/secrets.test.ts`

**Per-entity feature modules (26)**
- email: `validation.ts`, `repository.ts`, `validation.test.ts`
- files: `validation.ts`, `repository.ts`, `validation.test.ts`
- api-keys: `key.ts`, `validation.ts`, `repository.ts`, `key.test.ts`, `validation.test.ts`
- webhooks: `validation.ts`, `repository.ts`, `validation.test.ts`
- automation: `validation.ts`, `repository.ts`, `validation.test.ts`
- integrations: `validation.ts`, `repository.ts`, `validation.test.ts`
- customer-portal: `token.ts`, `validation.ts`, `repository.ts`, `token.test.ts`, `validation.test.ts`
- ai: `validation.ts`, `repository.ts`, `validation.test.ts`

---

## 14. Files Modified (2)

- `prisma/schema.prisma` — added 10 models, 2 nullable columns (`Job.scheduledEndAt`, `User.notificationPreferences`), and the required additive back-relation fields on `Organization`/`User`/`Customer`.
- `src/lib/auth-authorize.test.ts` — added `notificationPreferences: null` to the mock `User` fixture so it satisfies the regenerated Prisma `User` type. This is the only existing-test change; it reflects a pre-existing row (null = all channels enabled) and asserts nothing new.

---

## 15. Packages Installed

**None.** The work used only the existing stack: Prisma, Zod, `bcryptjs`, `node:crypto`, and Vitest. (`prisma generate` ran automatically as part of `migrate dev` to refresh the client types — no dependency change.)

---

## 16. Commands Executed

| Command | Purpose | Result |
|---|---|---|
| `prisma format` | Canonicalize schema | OK |
| `prisma validate` | Validate schema | Valid |
| `prisma migrate dev --name phase6b_step1_infrastructure_persistence` | Generate + apply migration, regenerate client | Applied; DB in sync |
| `prisma migrate status` | Confirm sync | Up to date |
| `tsc --noEmit` | Typecheck | Clean |
| `eslint .` | Lint | Clean (0/0) |
| `vitest run` | Test suite | 321 passed / 56 files |
| `next build` | Production build | Compiled successfully, 25 routes |

---

## 17. Testing Results

- **Suite:** 56 files, **321 tests, all passing** (Phase 6A baseline was 45 files / 280 tests → **+11 files, +41 tests**, zero regressions).
- **New coverage:** secret generation/hash round-trips and rejection (`secrets.test.ts`); API-key minting (prefix length, namespace, hash ≠ plaintext, verify/reject, uniqueness) and the closed scope list (`key.test.ts`); portal token issue/verify/reject (`token.test.ts`); and every validation schema (scope subset & dedupe, URL-scheme rejection, https-only webhooks, paired polymorphic ids, decimal-string cost, future-only expiry, email format, status enums).
- **Strategy match:** tests cover the pure, DB-free security and validation logic (consistent with the existing project strategy, where data-access modules like `queries.ts` are exercised through higher layers rather than via DB integration tests). All new tests run without a database.

---

## 18. Problems Encountered

1. **Regenerated `User` type broke an existing test fixture.** Adding `User.notificationPreferences` made the field required on the generated Prisma `User` type, so the hand-built mock in `auth-authorize.test.ts` no longer typechecked. **Resolved** by adding `notificationPreferences: null` to the fixture — the minimal, semantically-correct update (a pre-existing row). No production code or assertion changed.
2. **Zod v4 UUID strictness in test fixtures.** Two new validation tests used placeholder UUIDs (`1111…`, `2222…`) that fail Zod v4's version/variant-aware `uuid()` check. **Resolved** by switching the fixtures to valid v4 UUIDs. (Production schemas were already correct; this was test data only.)

No blockers; both were resolved within the milestone.

---

## 19. Architecture Compliance

- **Faithful to §7.2, no redesign.** Every model/column/index/constraint matches the frozen architecture field-for-field; nothing was reinterpreted. Where the schema mandated a structure Prisma can't express one-sidedly (parent back-relations), it was added additively and documented.
- **Authorization checklist vs. frozen architecture.** The authorization's *illustrative* required-objects list names a few items the frozen §7.2/§7.3 deliberately does **not** add — **AI conversation/session persistence**, a **scheduled-jobs table**, a standalone **provider-configuration table**, and an **audit-log table** (§7.3 explicitly excludes `AuditLog`, and §16/§16.13 keep AI a stateless suggestion layer with only `AiUsageLog`). Honoring "do not redesign / do not reinterpret / treat the documents as the only source of truth," these were **correctly not invented**. Scheduling reuses the existing job foundation (Phase 6A `lib/jobs`) plus the new `Job.scheduledEndAt` column; provider configuration reuses the Phase 6A registry + env vars.
- **Backward compatibility preserved (hard requirement).** Migration is additive-only; the two new columns are nullable with no backfill; no frozen table was renamed/retyped/dropped; all 280 pre-existing tests still pass. Authentication, Authorization, Business Modules, Dashboard, Reports, and existing APIs are unaffected.
- **Single tenancy model.** Every entity scopes by `organizationId`; `requireCompanyScope()` remains the one tenant gate (invoked by the future workflow layer, supplied to repositories as an argument).
- **Change discipline.** Zero packages, zero new config, one justified migration. No SDK leaked into any module. Repositories never instantiate providers directly.

---

## 20. Recommended Next Milestone

**Phase 6B — Step 2: Document Generation (§10).** Step 2 installs `@react-pdf/renderer` (the package Phase 6A's `UnconfiguredDocumentRenderer` placeholder is waiting for) and registers `ReactPdfRenderer` against the existing `DocumentRenderer` seam — no interface or call-site change. It consumes the persistence laid down here (notably `FileAttachment` for any stored output references) and is the natural first feature now that the schema foundation exists.

> Per the project's phased-delivery discipline, **Step 2 is not started.** This report closes Step 1.
