# QuoteFlow — Phase 4: Core Business Foundation Architecture
## (Frozen v2.1 — Schema-Reconciled)

**Status:** Phase 4 — Frozen v2.0, completed 2026-06-27
**Supersedes:** Phase 4 Architecture v2.0 (which was written against an assumed schema shape, not the real one)
**Depends on:** Phase 1 (Project Foundation), Phase 2 (Database Architecture — frozen, `QuoteFlow_Standard_Package_Database_Architecture.md`), Phase 2.1 (Database Hardening), Phase 3 (Authentication Architecture — frozen v2.0)
**Consumed by:** Phase 5+ (Leads, Quotes, Jobs, Customers, Invoices, Reports, AI features)

---

## Revision Notes (v2.0 → v2.1)

v2.0 was architected before the real, frozen `schema.prisma` was available in this session and made four wrong assumptions about it. This revision corrects all four against the actual frozen schema and the actual `QuoteFlow_Standard_Package_Database_Architecture.md`. Nothing about the *architectural decisions* from the v1.0→v2.0 pass (sectioned/versioned config, atomic counters instead of JSON counters, extended notification model, caching strategy, search ranking, exporter interface, extended DataTable contract, page layout primitives, feature flags) changes — only their grounding against reality does.

| # | Wrong assumption in v2.0 | Reality (frozen schema) | Resolution in v2.1 |
|---|---|---|---|
| 1 | A `Company` model with a `settingsJson` field | The tenant model is `Organization`, with a `Json` field named `settings` | Every database-level reference now reads `Organization`/`settings`/`organizationId`. Application-layer identifiers (`getCompanyConfig()`, `CompanyConfigSchema`, `requireCompanyScope()`, etc.) deliberately **keep** their "Company" naming as an internal convenience term — see the naming note in Section 5. No new `Company` table is created. |
| 2 | `Activity` is Lead-only (`leadId`) and needs migrating to a polymorphic shape | `Activity` is **already** polymorphic — `organizationId`, `entityType` (a real `EntityType` enum: `LEAD`/`QUOTE`/`JOB`/`CUSTOMER`/`INVOICE`), `entityId`, `type`, `message`, `createdById`, `createdAt` — and is in fact richer than v2.0's own design (it carries `organizationId` directly, where v2.0 had relied on a weaker join-based scope) | §31 is retired with no migration. Section 14 is rewritten to describe the real model. Roadmap Step 2 becomes a verification step, not a migration. |
| 3 | `Quote.quoteNumber`/`Invoice.invoiceNumber` are nullable and assigned at send-time | They already exist, are `NOT NULL`, and already carry a DB-level `@@unique([organizationId, quoteNumber])` / `@@unique([organizationId, invoiceNumber])` constraint, because `Quote`/`Invoice` already carry `organizationId` directly | §29 is narrowed to **only** add `Organization.nextQuoteNumber`/`nextInvoiceNumber` (atomic counters). Numbers are now understood to be assigned at **creation time**, not send-time, since a `NOT NULL` column can't exist on a Draft otherwise. Sequence gaps from abandoned drafts are accepted as normal; duplicates remain prevented by the atomic counter — that distinction is made explicit in Section 5.6 and Section 24. |
| 4 | Settings changes should log to the Activity feed under a new `COMPANY` entity type | The real `EntityType` enum is closed to `LEAD`/`QUOTE`/`JOB`/`CUSTOMER`/`INVOICE`, and there's no proven need yet to extend it for a solo-operator, OWNER-only settings screen | The `logActivity()` call inside `updateCompanyConfig()` is removed. No enum change. This is documented as a deferred-pending-real-need decision, consistent with how Soft Delete and AuditLog are already deferred. |

Two smaller corrections, found while reconciling, not from a direct question but implied by the real schema:
- **`Notification.entityType`** is now typed against the real `EntityType` enum instead of a free `String?`, for consistency with `Activity`/`Note`/`Task`, which all use the same enum.
- **ID defaults** for the new `Notification` model use the project's actual convention — native `@default(uuid()) @db.Uuid` — not `cuid()`, which v2.0 used by habit rather than by checking.

One additional, non-corrective note: the frozen schema already includes **`Note`** and **`Task`** as siblings of `Activity`, sharing the same polymorphic shape. These are complete, frozen Phase 2 entities — Phase 4 does not build anything for them (Phase 5 features will consume them directly via Prisma, the same way they'll consume `Activity`). They're mentioned in Section 4.4 so this document doesn't read as having missed them.

---

## 1. Executive Summary

### Purpose
Phase 4 builds the **operating system layer** QuoteFlow runs on — the infrastructure every future feature module (Leads, Quotes, Jobs, Customers, Invoices, Reports, AI) imports rather than reinvents.

### Goals
1. Give the application a real shell (layout, navigation, breadcrumbs, error/empty/loading states, reusable page primitives) before any business screen is built.
2. Make `Organization`-level configuration (branding, numbering format, tax, currency, timezone, business hours, feature flags) a first-class, owner-editable, versioned subsystem behind a single Configuration Service — built entirely on the frozen `Organization.settings` `Json` column, with zero schema change for the configuration data itself.
3. Move the one piece of state that genuinely cannot live safely in JSON — atomically-incrementing sequence counters for quote/invoice numbers — onto dedicated, atomically-incrementable columns on `Organization`.
4. Confirm (not build) that `Activity` already supports every future entity's timeline, since Phase 2 already generalized it.
5. Establish the remaining platform-level services (notifications, search, file handling, exports, soft delete, caching, data tables, page layout, feature flags) as documented contracts later phases call.
6. Lock down conventions (folder structure, server action standards, validation standards, permission helpers) so every subsequent phase is mechanical to build and review.
7. Extend — never fight — the frozen Phase 2 schema and the frozen Phase 3 auth/permission model.

### Non-goals
- No business-entity features (Leads, Quotes, Jobs, Customers) — those are Phase 5+.
- No real email/SMS sending (Resend remains deferred).
- No real file storage provider (Vercel Blob remains deferred).
- No `AuditLog` table, no `Role`/`Permission` tables, no `PriceList`/`PriceListItem`, no `CustomerContact`, no `ServiceCategory` nesting, no `QuoteVersionSnapshot`, no multi-organization `User` membership, no third-party integration fields — all explicitly excluded by the frozen database architecture document, and none of them are reopened here.
- No soft delete implementation — still deferred (Section 4.4).
- No `EntityType` enum changes.
- No code beyond what Section 26's roadmap explicitly scopes.

### Success criteria
- Every subsystem in Section 3 has a documented contract a Phase 5 engineer could implement against without asking a clarifying question — and, after this revision, without that engineer discovering the document was wrong about the schema.
- Every schema change in Section 4 is checked against the real, frozen `schema.prisma`, not inferred.
- The roadmap in Section 26 is granular enough to execute, verify, and commit one step at a time.

---

## 2. Architectural Principles

| Principle | How Phase 4 v2.1 honors it |
|---|---|
| **Frozen schema as a hard constraint** | Every schema change is checked against the actual frozen schema this time, not assumed. The only changes are two new, additive columns on `Organization` (§29) and one new table (`Notification`, §30) — both narrower than v2.0 believed was needed, because the real schema already does more than v2.0 gave it credit for. |
| **Single authoritative source of truth** | This document now matches `prisma/schema.prisma` and `QuoteFlow_Standard_Package_Database_Architecture.md` field-for-field. Where this document and the real schema ever disagree again in the future, the schema wins, and this document gets corrected — never the other way around. |
| **Tenant isolation** | Every subsystem remains scoped by the real `organizationId` column, which — as the reconciliation revealed — is already present directly on more tables (including `Activity`) than v2.0 assumed. |
| **Don't store what a real column does better** | Restated, now correctly grounded: `Organization.settings` is right for configuration; `Organization.nextQuoteNumber`/`nextInvoiceNumber` are right for atomic counters. The line is in the same place v2.0 drew it — only the surrounding table names were wrong. |
| **Verify before you architect** | New, explicit principle this revision adds: when a frozen artifact (schema, auth doc) exists but isn't in hand, treat any description of it as unverified and flag it as an assumption rather than presenting it as fact (as the original v1.0/v2.0 "Note on Inputs" should have done more forcefully). This document was corrected through exactly the elicitation process this principle recommends. |

---

## 3. Functional Requirements

### 3.1 Organization Settings & Company Configuration Service
- **Purpose:** One governed place an Owner configures everything about how their organization presents itself and how the system behaves for them — and one governed place every other module reads that configuration from.
- **Responsibilities:** Own the versioned, sectioned shape stored in the real `Organization.settings` `Json` column; validate every read and write; merge defaults; migrate older `version` shapes on read; cache reads; invalidate on write; be the *only* code path allowed to touch `Organization.settings` directly.
- **Inputs:** Owner-submitted form data for writes; any module's `organizationId` for reads.
- **Outputs:** A typed, current-version `CompanyConfig` object (see Section 5 for the naming note).
- **Dependencies:** The frozen `Organization.settings` field; Phase 3's `requireRole(["OWNER"])`; the Caching Strategy (Section 21).
- **Future consumers:** Quote builder, Invoice module, Dashboard, every PDF export, the Setup Wizard, feature-flagged nav items.

### 3.2 File Storage Architecture
Unchanged from v2.0. `FileRef` contract; `Organization.logoUrl` (confirmed real, nullable `String`) is the V1 consumer.

### 3.3 Activity Architecture (Already Satisfied — No Build Required)
- **Purpose:** A human-readable, append-only narrative of what happened to any record.
- **Responsibilities:** Confirm the real `Activity` model already satisfies this need for every Phase 5 entity; build the thin `logActivity()`/`getActivityForEntity()` wrapper functions and the `<ActivityTimeline>` component against the real fields. **No schema change, no migration.**
- **Inputs:** `{ entityType: EntityType, entityId, type, message?, createdById }`.
- **Outputs:** A reverse-chronological timeline component, reusable across Lead, Quote, Job, Customer, and Invoice detail views from day one of Phase 5.
- **Dependencies:** The frozen `Activity` model (Section 4.2).
- **Future consumers:** Every entity detail view with a history tab.
- **Status:** Corrected in v2.1 — v2.0 incorrectly believed this needed a Phase-4 migration.

### 3.4 Audit Framework
Unchanged. Still correctly deferred — see the frozen database architecture document's own statement that `AuditLog` is explicitly out of scope at this tier.

### 3.5 Notification Framework (Extended)
- **Purpose:** Tell a user, inside the app, that something needs their attention.
- **Responsibilities:** Define the producer/consumer contract; define lifecycle; type `entityType` against the real `EntityType` enum for consistency with `Activity`/`Note`/`Task`.
- **Inputs:** Domain events from any feature module.
- **Outputs:** A notification record a user can see, act on, and dismiss.
- **Dependencies:** Schema addition §30 (Section 4.2).
- **Future consumers:** Every business module; Resend integration when active.

### 3.6 Global Search Architecture (Ranked)
Unchanged from v2.0. Lead (`name`, `phone`, `email`) and Customer (`name`, `phone`, `email`) are confirmed-real, company-scoped fields.

### 3.7 Soft Delete Architecture
Unchanged — still deferred. The frozen database architecture document independently confirms this was a deliberate Phase 2 exclusion ("hard delete with a confirmation step is simpler and sufficient at this scope"), which corroborates Phase 4's own reasoning rather than conflicting with it.

### 3.8 Export Architecture (Exporter Interface)
Unchanged from v2.0.

### 3.9 Reusable Data Table Framework (Extended Contract)
Unchanged from v2.0.

### 3.10 Permission & Tenant Helper Standards
- **Purpose:** Make "is this user allowed to do this, and is this data theirs to see" mechanical.
- **Responsibilities:** Formalize the Phase 3 helpers; `requireCompanyScope()` returns `{ organizationId: session.organizationId }` — corrected from the v2.0 `{ companyId }` shape to match the real session claim.
- **Status:** Corrected in v2.1 (return shape only — the helper's existence and purpose are unchanged).

### 3.11 Shared Page Layout Primitives
Unchanged from v2.0.

### 3.12 Feature Flag Architecture
Unchanged from v2.0. Lives inside the same `Organization.settings.featureFlags` section.

### 3.13 Caching Strategy
Unchanged from v2.0, with cache tags renamed `org-config-${organizationId}` (Section 21).

---

## 4. Database Review

### 4.1 Does the existing schema already support Phase 4?
**Yes, more thoroughly than v2.0 believed.** `Organization.settings` (a real, frozen `Json` field — confirmed against both `schema.prisma` and the database architecture document) is the correct extension point for branding, business hours, locale, taxation format, numbering format, PDF/email presentation, and feature flags — zero schema changes required for any of it. `Organization.logoUrl` (real, nullable `String`) already implements the File Storage V1 pattern.

### 4.2 Schema changes — approved for Phase 4 (corrected)

**§29 — Numbering: atomic counters only**
- `Organization.nextQuoteNumber Int @default(1)`
- `Organization.nextInvoiceNumber Int @default(1)`
- **What did NOT change:** `Quote.quoteNumber String` and `Invoice.invoiceNumber String` already exist, are already `NOT NULL`, and already carry `@@unique([organizationId, quoteNumber])` / `@@unique([organizationId, invoiceNumber])` — a real, physical, database-enforced uniqueness guarantee that v2.0 mistakenly believed didn't exist (v2.0 assumed `Quote`/`Invoice` had no direct `organizationId` and designed around that gap; the real schema already has `organizationId` directly on both). The atomic counter and the existing unique constraint are now two independent, layered guarantees against a duplicate number: the counter prevents the application from *generating* the same number twice; the constraint would catch it at the database level even if it somehow did.
- **Lifecycle correction:** because the number columns are `NOT NULL`, a number must be assigned at **creation time**, not send-time as v2.0 assumed. `createQuote()`/`createInvoice()` (Phase 5 business logic, not built in Phase 4) will call `getNextQuoteNumber(organizationId)`/`getNextInvoiceNumber(organizationId)` as part of constructing the row. Every quote/invoice ever created — including an abandoned Draft — consumes a sequence number. **This is intentional and acceptable:** sequence *gaps* (a skipped number from an abandoned draft) are normal in real-world invoicing/quoting systems and are not a defect; sequence *duplicates* are the actual failure mode, and the atomic counter (plus the existing unique constraint as a backstop) is what prevents those.
- **Why still dedicated columns, not JSON:** unchanged reasoning from v1.0→v2.0 — a real column lets Postgres perform the entire increment as one atomic statement (`UPDATE "Organization" SET "nextQuoteNumber" = "nextQuoteNumber" + 1 ... RETURNING "nextQuoteNumber"`), with the database's own row locking serializing concurrent callers.

**§30 — Notification (corrected)**
```
model Notification {
  id          String     @id @default(uuid()) @db.Uuid
  organizationId String  @db.Uuid
  organization Organization @relation(fields: [organizationId], references: [id])
  userId      String     @db.Uuid
  user        User       @relation(fields: [userId], references: [id])
  type        String
  title       String
  body        String?
  priority    String     @default("NORMAL")   // "LOW" | "NORMAL" | "HIGH"
  entityType  EntityType?
  entityId    String?    @db.Uuid
  actionUrl   String?
  actionLabel String?
  metadata    Json?
  isRead      Boolean    @default(false)
  readAt      DateTime?
  createdAt   DateTime   @default(now())

  @@index([organizationId, userId, isRead, createdAt])
}
```
- **Corrected from v2.0:** `entityType` is now `EntityType?` (the real, existing enum — `LEAD`/`QUOTE`/`JOB`/`CUSTOMER`/`INVOICE`) instead of a free `String?`, matching `Activity`/`Note`/`Task`'s own convention. IDs use native `@default(uuid()) @db.Uuid`, matching every other model in the schema, instead of `cuid()`. `organizationId`/`userId` are real foreign keys to the real `Organization`/`User` models.
- **Why both `isRead` and `readAt`, why `priority`/`actionUrl`/`actionLabel`/`metadata`:** unchanged reasoning from v2.0 (Section 4.2 of that document) — still valid, not schema-dependent.

**§31 — Activity generalization: retired, no action needed**
- The real `Activity` model is:
```
model Activity {
  id             String     @id @default(uuid()) @db.Uuid
  organizationId String     @db.Uuid
  entityType     EntityType
  entityId       String     @db.Uuid
  type           String
  message        String?
  createdById    String     @db.Uuid
  createdAt      DateTime   @default(now())

  @@index([organizationId, entityType, entityId])
}
```
- This already satisfies every requirement Section 3.3/14 needs: polymorphic addressing, tenant scoping, and an index that supports "fetch a record's timeline, newest-first, scoped to its organization" in a single indexed lookup — and it scopes by `organizationId` directly, which v2.0's own design did not (v2.0 relied on `entityId` resolving to a record that happened to belong to the right organization, a weaker and slower guarantee). **No migration. No code change to the schema. Phase 4's only job here is to build the application-layer wrapper functions against these real field names** (`message` not `note`; `createdById` not `createdBy`; `entityType` is a real enum value, not an arbitrary string).

### 4.3 Why this revision treats "verify, don't assume" as the headline lesson
Three of the four corrections in this revision (§29's scope, §31's retirement, the Notification/Activity naming) all trace back to the same root cause: v2.0 was written from an inferred schema, not the real one. None of the *architectural reasoning* from v1.0→v2.0 was wrong — sectioned/versioned config, atomic counters over JSON counters, an extended notification model, and a generalized Activity table were all the right calls. What was wrong was assuming a generic, plausible-sounding schema shape instead of checking the one that actually exists. This document is the corrected record; the lesson is procedural, not architectural.

### 4.4 Entities Phase 4 doesn't touch, confirmed
`AuditLog`, `Role`/`Permission` tables, `PriceList`/`PriceListItem`, `CustomerContact`, `ServiceCategory` nesting, `QuoteVersionSnapshot`, multi-organization `User` membership, third-party integration fields — all explicitly listed as out-of-scope in the frozen database architecture document's own Section 9, independent of anything Phase 4 says. Soft delete remains deferred for the same reason given in v2.0 (Section 4.4 of that document): no proven need yet, and the frozen schema's own author independently reached the same conclusion ("soft-delete discipline is real overhead you don't need yet").

`Note` and `Task` already exist as frozen siblings of `Activity`, sharing the identical polymorphic shape (`organizationId`, `entityType`, `entityId`, plus their own content/title fields). Phase 4 does not build anything for them — they are Phase 2-complete, and Phase 5 features will read/write them directly via Prisma the same way they'll use `Activity`, with no platform-level wrapper needed beyond what Phase 4 already builds for `Activity` itself (Notes and Tasks are business features with their own UI, not a generic cross-cutting platform service the way an audit timeline is).

---

## 5. Company Configuration Architecture

> **Naming note:** This section and the rest of the document continue to call this subsystem the "Company Configuration Service," with identifiers like `getCompanyConfig()`, `updateCompanyConfig()`, `CompanyConfigSchema`, and `DEFAULT_COMPANY_CONFIG`. **There is no `Company` table.** This is a deliberate naming choice, confirmed during schema reconciliation rather than left as an unexamined leftover: "Company" reads naturally in conversation and code as "the tenant," and renaming every identifier to "Organization" throughout this already-large document would be pure churn with no functional benefit, since every one of these functions operates on the real `Organization` model and its real `settings` field underneath. If this naming ever causes real confusion during implementation, renaming it is a mechanical find-and-replace, not an architecture change.

### 5.1 The sectioned, versioned shape of `Organization.settings`
```ts
{
  version: 1,
  branding: {
    primaryColor: "#16243B",
    accentColor: "#F2994A",
  },
  businessHours: {
    schedule: { /* per-day open/close, optional */ },
  },
  locale: {
    dateFormat: "MM/DD/YYYY",
    // Note: currency and timezone are NOT duplicated here — they already
    // exist as their own real, top-level Organization columns
    // (Organization.currency, Organization.timezone). This section holds
    // only locale settings that have no dedicated column.
  },
  taxation: {
    defaultTaxRatePercent: 0,
  },
  numbering: {
    quotePrefix: "Q",
    invoicePrefix: "INV",
    padding: 4,
    resetPolicy: "never",
  },
  pdf: {
    headerText: "",
    footerText: "",
    showLogo: true,
  },
  email: {
    quoteSentSubjectTemplate: "Your quote from {{organizationName}}",
    quoteSentBodyTemplate: "",
  },
  featureFlags: {
    ai: false,
    portal: false,
    automation: false,
    advancedReports: false,
    invoicing: true,
    integrations: false,
  },
  integrations: {},
}
```
**Correction from v2.0:** the v2.0 draft put `currency` inside `config.locale`. The real `Organization` model already has its own top-level `currency String` and `timezone String` columns. Re-storing them inside `settings` would create two sources of truth for the same fact. `getCompanyConfig()` therefore reads `currency`/`timezone` directly off the `Organization` row (alongside `name`, `slug`, `logoUrl`) and merges them into the returned `CompanyConfig` object for convenience, rather than ever writing them into the JSON. `updateCompanyConfig()` correspondingly accepts `currency`/`timezone` as top-level `Organization` column updates, not as a `settings.locale` patch.

### 5.2–5.4 Why sectioned, versioning strategy, migration strategy
Unchanged from v2.0 — none of this reasoning was schema-dependent. (Composable validation/defaults per section; `version` at the document root; upgrade-on-read + write-back-on-read; collapse migration functions once three or more accumulate.)

### 5.5 The Company Configuration Service (corrected)
```
lib/config/
├── schema.ts        # CompanyConfigSchema
├── defaults.ts       # DEFAULT_COMPANY_CONFIG
├── migrations.ts     # CURRENT_CONFIG_VERSION + migration functions
├── cache.ts           # React cache() + tag-based invalidation
└── service.ts         # getCompanyConfig(organizationId), updateCompanyConfig(organizationId, partial)
```

**`getCompanyConfig(organizationId): Promise<CompanyConfig>`**
1. Check cache; return if fresh.
2. `db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { settings: true, currency: true, timezone: true, name: true, logoUrl: true } })` — **the only place permitted to read `Organization.settings` directly.**
3. Run the raw `settings` value through `migrateToLatest()`.
4. `CompanyConfigSchema.parse(deepMerge(DEFAULT_COMPANY_CONFIG, migrated))`, then merge in the real `currency`/`timezone`/`name`/`logoUrl` columns read in step 2.
5. Cache and return.

**`updateCompanyConfig(organizationId, partial): Promise<CompanyConfig>`**
1. `requireRole(["OWNER"])` — enforced inside the service itself, in addition to whatever the calling action already checked.
2. Read the current full config.
3. Section-aware deep merge of the `settings`-backed portion of `partial`; top-level `Organization` columns (`currency`, `timezone`, `name`, `logoUrl`) in `partial` are routed to their own update fields, never into the JSON merge.
4. `CompanyConfigSchema.parse()` the merged `settings` portion — validation failure aborts before any write.
5. `db.organization.update({ where: { id: organizationId }, data: { settings: merged, ...topLevelColumnUpdates } })` — **the only place permitted to write `Organization.settings` directly.**
6. Invalidate cache; call `revalidateTag`/`revalidatePath` for every known consumer route.

**Corrected from v2.0:** step 7 of the v2.0 service ("`logActivity({ entityType: "COMPANY", ... })`") is **removed**. Per the Section 4.2/§4 reconciliation, settings changes are not logged to the Activity feed in this phase — there is no `COMPANY`/`ORGANIZATION` value in the real `EntityType` enum, and no proven need yet to add one for a solo-operator, OWNER-only screen. This can be revisited if a real multi-staff client later needs a settings audit trail; it would be an additive `EntityType` enum value at that point, not a redesign.

**Enforcement of "no module touches `Organization.settings` directly":** unchanged — a documented code-review rule (grep for `.settings` access outside `lib/config/` during PR review on `Organization` queries).

### 5.6 Numbering's relationship to the Configuration Service (corrected)
`lib/numbering.ts` depends on `lib/config/` to read the `numbering` section's *format* settings, but performs its own atomic increment directly against the real, dedicated `Organization` columns.

```ts
// lib/numbering.ts
export async function getNextQuoteNumber(organizationId: string): Promise<string> {
  const org = await db.organization.update({
    where: { id: organizationId },
    data: { nextQuoteNumber: { increment: 1 } },
    select: { nextQuoteNumber: true },
  });
  const sequence = org.nextQuoteNumber - 1;
  const { numbering } = await getCompanyConfig(organizationId);
  return formatNumber(numbering.quotePrefix, sequence, numbering.padding);
}
```
`getNextInvoiceNumber()` is the parallel function against `nextInvoiceNumber`.

**Call-site correction:** these are called by `createQuote()`/`createInvoice()` (Phase 5 business logic) at **creation time** — not by `sendQuote()` at send-time, as v2.0 assumed. This is a direct consequence of `Quote.quoteNumber`/`Invoice.invoiceNumber` being `NOT NULL` in the real schema: a Draft cannot exist without a number already assigned. Phase 4's responsibility ends at building and testing `getNextQuoteNumber()`/`getNextInvoiceNumber()`/`formatNumber()` in isolation (Section 26, Step 4); wiring them into `createQuote()`/`createInvoice()` is Phase 5's work, noted here only so the lifecycle assumption doesn't quietly resurface as a bug when Phase 5 starts.

### 5.7 Feature flags
Unchanged from v2.0 — still a section of the same `settings` document, read through the same service call.

---

## 6. Module Architecture

Unchanged from v2.0 in shape. One correction: every module that previously said "company-scoped" now means, concretely, "filtered by the real `Organization.id` / `organizationId` column" — restated here once so it doesn't need restating in every subsequent section.

```
features/
├── settings/          # Settings UI/forms — calls into lib/config, never touches Organization.settings itself
├── files/             # FileRef contract + V1 URL-based logo/photo handling
├── activity/           # logActivity()/getActivityForEntity() wrappers + <ActivityTimeline> — built against the real, already-polymorphic Activity model
├── notifications/      # In-app notification produce/consume contract
├── search/             # Global search query + ranked result aggregation
├── tables/             # Reusable DataTable contract
├── export/             # Exporter interface + CSV implementation
└── layout/             # PageLayout/PageHeader/PageActions/PageContent/PageSection primitives

lib/
├── config/             # Company Configuration Service (Section 5) — the only Organization.settings reader/writer
├── numbering/           # Atomic quote/invoice number generation against Organization.nextQuoteNumber/nextInvoiceNumber
├── permissions.ts        # requireSession/requireRole/requireActiveUser/requireCompanyScope
└── logger.ts             # standardized server-side logging
```

---

## 7. Folder Structure

Unchanged from v2.0 except the inline comments now describe the real model.

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── settings/page.tsx
│   │   ├── settings/team/page.tsx
│   │   └── ...
│   └── api/
│       └── lead-capture/route.ts
├── features/
│   ├── settings/
│   │   ├── components/
│   │   └── actions.ts                    # thin wrappers calling lib/config (reads/writes Organization.settings)
│   ├── files/
│   │   ├── components/                   # FileUrlInput
│   │   └── types.ts                      # FileRef
│   ├── activity/
│   │   ├── components/                   # ActivityTimeline (entityType/entityId-driven, against the real Activity model)
│   │   ├── actions.ts                    # logActivity()
│   │   └── queries.ts                    # getActivityForEntity(entityType: EntityType, entityId)
│   ├── notifications/
│   │   ├── components/                   # NotificationBell, NotificationCenter
│   │   ├── actions.ts                    # createNotification(), markRead(), markAllRead()
│   │   └── queries.ts                    # getUnreadNotifications()
│   ├── search/
│   ├── tables/
│   ├── export/
│   └── layout/
├── components/
│   ├── ui/
│   └── shared/
├── hooks/
├── lib/
│   ├── db.ts
│   ├── auth.ts
│   ├── permissions.ts                     # requireCompanyScope() returns { organizationId }
│   ├── numbering/
│   │   └── index.ts                        # getNextQuoteNumber(), getNextInvoiceNumber() — against Organization.nextQuoteNumber/nextInvoiceNumber
│   ├── config/
│   │   ├── schema.ts
│   │   ├── defaults.ts
│   │   ├── migrations.ts
│   │   ├── cache.ts
│   │   └── service.ts                      # reads/writes Organization.settings (+ Organization.currency/timezone/name/logoUrl)
│   ├── logger.ts
│   └── pdf/
└── utils/
```

---

## 8. Navigation Architecture

Unchanged — the role mapping (`OWNER`/`STAFF`/`FIELD`) was already confirmed correct against the real `Role` enum in Phase 3's own `§27 Addendum`, which this revision independently re-confirms by reading the same enum directly in `schema.prisma`.

---

## 9–13. UI/UX Standards, Page Layout, Server Action Standards, Validation Standards, Permission Model

Unchanged from v2.0 in every respect except:
- Every code example referencing `requireCompanyScope()` now shows it returning `{ organizationId: session.organizationId }`.
- Every code example referencing the Configuration Service now reads/writes `Organization.settings`, not `Company.settingsJson`.
- Section 13's permission table is restated below with the corrected return shape:

| Helper | Behavior | Used by |
|---|---|---|
| `requireSession()` | Confirms a valid session; returns `{ userId, organizationId, role }` | Every server action |
| `requireRole(allowedRoles[])` | Throws/redirects if `session.role` isn't allowed | OWNER-restricted actions, and internally inside `updateCompanyConfig()` |
| `requireActiveUser()` | Confirms the account isn't deactivated | Every server action |
| `requireCompanyScope()` | Returns `{ organizationId: session.organizationId }` for direct spreading into a Prisma `where` | Every organization-scoped query, including the Configuration Service, Activity, Notifications, and Search |

---

## 14. Activity Architecture (Already Satisfied — Built Against the Real Model)

### Model (real, frozen — no migration)
```
Activity { id, organizationId, entityType: EntityType, entityId, type, message?, createdById, createdAt }
@@index([organizationId, entityType, entityId])
```

### Event taxonomy
`created`, `status_changed`, `assigned`, `note_added`, `quote_sent`, `quote_viewed`, `quote_accepted`, `quote_declined`, `job_scheduled`, `job_completed`. (The v2.0 taxonomy's `settings_updated` entry is **removed** — nothing emits it, per Section 4.2/§4's correction. If a future phase needs an audit trail for settings changes, this taxonomy gains an entry and the `EntityType` enum gains a value at that time, not before.) New event types remain additive strings.

### Querying
`getActivityForEntity(entityType: EntityType, entityId: string)` → reverse-chronological, paginated past 50 entries, scoped by `organizationId` via `requireCompanyScope()`.

### Timeline rendering
`<ActivityTimeline entityType={EntityType} entityId={string} />` — one component, reused unmodified for `LEAD`, `QUOTE`, `JOB`, `CUSTOMER`, and `INVOICE` from day one of Phase 5, since the real `EntityType` enum already enumerates exactly those five values.

### Why this required no schema work in Phase 4
Phase 2 already generalized `Activity` before Phase 4 architecture began — and did it with a stronger design than v2.0 independently proposed (direct `organizationId` scoping, a real enum instead of a free string). Credit for "do it now, not deferred" belongs to whoever designed Phase 2's schema, not to this document.

### Retention & indexes
Unchanged reasoning from v2.0: indefinite retention at this scale; `@@index([organizationId, entityType, entityId])` is the only index this access pattern needs.

---

## 15. Notification Architecture (Extended, Corrected)

### Model
See §30 (Section 4.2) — `entityType EntityType?`, native `uuid()` ids, real `Organization`/`User` foreign keys.

### Lifecycle, navigation, extensibility
Unchanged from v2.0 (Section 15 of that document) — none of this reasoning was schema-dependent. `metadata` remains structured, app-internal data only, never rendered as raw HTML (Section 22).

---

## 16–20. File Storage, Search, Export, DataTable, Feature Flags

Unchanged from v2.0 in every respect; all reasoning in these sections was already schema-agnostic (URL-paste pattern, search ranking tiers, the Exporter interface, the extended DataTable prop contract, feature flags inside `settings.featureFlags`). The only textual change is `companyId`/`Company` → `organizationId`/`Organization` wherever they appeared in code samples (e.g., `globalSearch()`'s `requireCompanyScope()` call, the `Exporter` registry, `<DataTable>`'s prop types).

---

## 21. Caching Strategy

Unchanged from v2.0 except the cache tag naming: `org-config-${organizationId}` (was `company-config-${companyId}`). The absolute rule is unchanged and restated because it matters most: **authorization and session reads are never cached** — `requireSession()`, `requireRole()`, `requireActiveUser()` always read live.

---

## 22. Security Review

Unchanged from v2.0 with one update: the numbering-counter risk entry now reflects the corrected lifecycle (creation-time assignment) and the *additional* protection the real schema already provides (the existing `@@unique([organizationId, quoteNumber])`/`@@unique([organizationId, invoiceNumber])` constraints, which v2.0 didn't know existed) — restated in Section 24.

---

## 23. Testing Strategy

| Layer | Tool | Phase 4 v2.1 coverage (corrected) |
|---|---|---|
| Unit | Vitest | `CompanyConfigSchema` parsing; migration chain correctness; `formatNumber()`; search tier-ordering; `Exporter` registry dispatch. |
| Integration | Vitest + Prisma test DB | **Numbering:** two concurrent calls to `getNextQuoteNumber()` for the same organization never return the same sequence number — proving the atomic counter, independent of the (already-existing) unique constraint acting as a backstop. **Activity:** `getActivityForEntity()` returns entries correctly scoped by `organizationId` + `entityType` + `entityId`, newest-first — a correctness test against the existing real model, **not** a migration/backfill test (removed in this revision, since no migration occurs). **Notifications:** create → unread → `markRead()` → `isRead`/`readAt` update correctly, with `entityType` validated against the real enum. **Config caching:** `updateCompanyConfig()` immediately followed by `getCompanyConfig()` never returns stale data. |
| Component | React Testing Library | Settings forms; `<PageLayout>` family; `<DataTable>` states; `NotificationCenter` read/unread; feature-flag-gated nav rendering. |
| E2E | Playwright | Settings change reflects in a quote PDF preview without a manual refresh; STAFF blocked from `/settings`; global search ranking and organization-scoping; `<ActivityTimeline>` renders correctly for at least two different `entityType` values using real data. |

---

## 24. Risks

| Risk | Severity | Status | Mitigation |
|---|---|---|---|
| **Numbering counter race condition** | — | Closed | Atomic `UPDATE ... increment` on `Organization.nextQuoteNumber`/`nextInvoiceNumber`, now additionally backstopped by the real, pre-existing `@@unique([organizationId, quoteNumber])` constraint — a duplicate is structurally impossible at two independent layers. |
| **Sequence gaps from abandoned drafts** | None (by design) | Accepted, not a risk | Explicitly documented in Section 4.2/§29: gaps are normal and acceptable in numbering systems; only duplicates matter, and those are prevented. Stated here so a future engineer doesn't "fix" this as a perceived bug. |
| **`Organization.settings` schema drift** | Medium | Mitigated | `updateCompanyConfig()` re-parses the full merged document before saving. |
| **Cache invalidation gaps** | Medium | Mitigated by centralization | The Configuration Service is the only writer to `Organization.settings`. |
| **Notification table growth** | Low (not yet) | Documented, deferred | Same reasoning as v2.0. |
| **Search performance at scale** | Low (not yet) | Documented growth path | `pg_trgm` upgrade, same as v2.0. |
| **Documentation drifting from the real schema again** | Medium | Mitigated by process | This entire revision exists because that happened once already. The mitigation is procedural: any future Phase 4+ amendment that touches schema-level claims must be checked against the live `schema.prisma` before being written, not inferred from a prior document or a generic pattern. |

(The v2.0 risk entry "Activity migration backfill correctness" is removed — there is no migration, so there is nothing to mitigate.)

---

## 25. Definition of Done

Phase 4 is complete when **all** of the following are true:

- [ ] `Organization.nextQuoteNumber` / `Organization.nextInvoiceNumber` exist as dedicated `Int` columns; `getNextQuoteNumber()`/`getNextInvoiceNumber()` use a single atomic `increment` operation.
- [ ] No change has been made to `Quote.quoteNumber`, `Invoice.invoiceNumber`, or their existing unique constraints.
- [ ] The numbering concurrency integration test passes.
- [ ] `logActivity()`/`getActivityForEntity()` are implemented against the real `Activity` model's actual field names (`message`, `createdById`, the real `EntityType` enum) — confirmed with no schema migration involved.
- [ ] `<ActivityTimeline>` renders correctly against at least two different real `EntityType` values.
- [ ] `CompanyConfigSchema` covers every section in Section 5.1, correctly excludes `currency`/`timezone` from the JSON (since they're real top-level `Organization` columns), and `DEFAULT_COMPANY_CONFIG` matches `CURRENT_CONFIG_VERSION`.
- [ ] No file outside `lib/config/` reads or writes `Organization.settings` directly.
- [ ] `getCompanyConfig()`/`updateCompanyConfig()` are OWNER-gated inside the service; `updateCompanyConfig()` does **not** call `logActivity()`.
- [ ] `Notification.entityType` is typed `EntityType?`, and ids use native `uuid() @db.Uuid`.
- [ ] `featureFlags` exist in `DEFAULT_COMPANY_CONFIG`, default per Section 20, and at least one nav item renders conditionally.
- [ ] Caching is implemented for Company Configuration and Notifications, with the E2E propagation test passing.
- [ ] Global search returns three-tier-ranked, organization-scoped results.
- [ ] The `Exporter` interface exists; only `csv` is implemented.
- [ ] `<DataTable>`'s extended prop contract compiles.
- [ ] Page layout primitives are used by every Settings sub-page.
- [ ] All gates pass: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, GitHub Actions CI.
- [ ] This document's status line is updated to **"Phase 4 — Frozen v2.1, completed [date]"**.

---

## 26. Implementation Roadmap

### Step 1 — Permission & Tenant Helper Formalization
- **Objective:** Add `requireCompanyScope()`, returning `{ organizationId: session.organizationId }`.
- **Deliverables:** `lib/permissions.ts`.
- **Verification:** `npm run typecheck`; unit test for the return shape.
- **Completion criteria:** PR merged.

### Step 2 — Activity Verification (No Migration Required)
- **Objective:** Confirm the real `Activity` model satisfies Section 14's contract; build `logActivity()`/`getActivityForEntity()` against its actual field names.
- **Prerequisites:** Step 1.
- **Deliverables:** `features/activity/{actions,queries}.ts` written directly against `organizationId`, `entityType: EntityType`, `entityId`, `type`, `message`, `createdById`. **No `prisma migrate` command is run as part of this step.**
- **Verification:** Integration test confirming entries are returned newest-first, correctly scoped by `organizationId` + `entityType` + `entityId`.
- **Completion criteria:** PR merged; no schema diff present in the PR.

### Step 3 — Company Configuration Schema, Defaults & Migration Utility
- **Objective:** Build `CompanyConfigSchema`/`DEFAULT_COMPANY_CONFIG`/`migrations.ts`, explicitly excluding `currency`/`timezone` (real `Organization` columns) from the JSON shape.
- **Prerequisites:** Step 1.
- **Deliverables:** `lib/config/{schema,defaults,migrations}.ts`.
- **Verification:** Unit tests parsing empty/partial/legacy JSON with defaults applied correctly.
- **Completion criteria:** PR merged.

### Step 4 — Numbering Counter Columns & Atomic Increment Helpers
- **Objective:** Add `Organization.nextQuoteNumber`/`nextInvoiceNumber` only — no change to `Quote`/`Invoice`. Build `lib/numbering/`.
- **Prerequisites:** Step 3.
- **Deliverables:** Migration adding the two `Organization` columns; `getNextQuoteNumber()`, `getNextInvoiceNumber()`, `formatNumber()`.
- **Verification:** `npx prisma migrate dev`; the concurrency integration test.
- **Completion criteria:** PR merged; concurrency test passing; migration diff touches only `Organization`.

### Step 5 — Company Configuration Service Implementation
- **Objective:** Implement `getCompanyConfig()`/`updateCompanyConfig()` against `Organization.settings` (+ the real `currency`/`timezone`/`name`/`logoUrl` columns), with the internal `requireRole` check. **No `logActivity()` call.**
- **Prerequisites:** Steps 1, 3.
- **Deliverables:** `lib/config/service.ts`.
- **Verification:** Integration test: write → read round-trip; section-aware merge; non-OWNER calls rejected; confirm no Activity row is created as a side effect of a settings update.
- **Completion criteria:** PR merged.

### Steps 6–18
Unchanged in structure and order from v2.0's Steps 6–18 (Dashboard Shell, Page Layout Primitives, Settings Screens, Shared States, Notification Model & UI, File Reference Contract, DataTable, Export Framework, Global Search, Caching Implementation, Feature Flag Wiring, Full Verification Pass) — only their internal field/variable references are corrected per this document's Sections 6–22. Notification's step now explicitly builds `entityType: EntityType?` and native `uuid()` ids per §30.

---

*This document is the canonical Phase 4 architecture reference, superseding v2.0 in full. It was produced by reconciling v2.0 against the real, frozen `schema.prisma` and `QuoteFlow_Standard_Package_Database_Architecture.md` — not by further inference. No application code was written, no migrations were executed, and no packages were installed in producing this revision.*
