# QuoteFlow — Phase 6: Advanced Platform Architecture
### Canonical Reference for Phase 6 Implementation

## 1. Document Control

| | |
|---|---|
| **Status** | **Phase 6 — Frozen v1.0; architecture 2026-06-28, implementation completed & DoD-verified 2026-07-02** (see `QuoteFlow_Phase6_Definition_of_Done.md`) |
| **Version** | 1.0 |
| **Phase** | 6 — Advanced Platform (Document Generation, Email, Customer Portal, Scheduling, Files, Automation, AI, Dashboards/Reports depth, Notifications depth, Integrations, Public API) |
| **Depends on** | Phase 1 (Project Foundation), Phase 2 (Database Architecture — frozen), Phase 3 (Authentication Architecture — frozen v2.0), Phase 4 (Core Business Foundation — frozen v2.1), Phase 5 (Business Modules — frozen v1.0, implemented per `QuoteFlow_Phase5_Implementation_Report.md`) |
| **Consumed by** | Phase 6 implementation; Premium/Enterprise tier upgrade paths; future vertical re-skins of the same codebase |
| **Owner** | Development OS (Architecture) |
| **Audience** | Any engineer implementing Phase 6, with no other context than this document and the five frozen documents it depends on |

This document is **architecture and planning only**. It contains no application code, no migrations, no package installations, and modifies no file. Code blocks shown are structural references (schema shapes, interface contracts, folder trees, illustrative call sequences) for implementation to follow, not implementation itself, exactly as Phases 3–5 used code blocks.

**No previous phase is modified or redesigned.** Phases 1–5 remain frozen exactly as delivered. Where Phase 6 needs new schema, it is strictly additive (new tables, or columns explicitly justified the same way Phase 4 justified `Organization.nextQuoteNumber`/`nextInvoiceNumber` and the `Notification` table) — no frozen table is altered, renamed, or dropped, and no frozen route, server action, or component built in Phases 1–5 is changed. Where Phase 6 needs a richer version of something Phase 5 already shipped (e.g., calendar scheduling), it is added as new, independent surface area alongside the frozen one, never a rewrite of it (Section 13).

**Freeze rule.** As of this version, this document is frozen. Implementation follows it exactly; if a question arises that it doesn't answer, implementation pauses and the document is amended first, never worked around silently in code. A change is justified only by a genuine design bug, a genuine security issue, or a real business-requirement change this document can't satisfy — never personal preference, a nicer-seeming alternative to something already decided, or a convenience shortcut under time pressure. This is the same freeze discipline Phase 3's authentication architecture (§1) established and Phase 6 carries forward unchanged.

---

## 2. Executive Summary

Phase 5 made QuoteFlow a working internal tool: a contractor's staff can run their entire Lead → Quote → Job → Invoice → Payment pipeline inside it. Phase 6 makes QuoteFlow a **commercial, multi-surface SaaS platform** built on top of that same pipeline, without touching the pipeline's own logic:

- A **customer-facing surface** (Customer Portal) that exists outside the staff application entirely.
- A **document layer** that turns existing Quote/Invoice/Job data into professional, branded PDFs on demand.
- A **communication layer** (Email) that is fully designed now and fully provider-agnostic, with a zero-cost default that ships immediately and a funded provider (Resend) that drops in later with no code rewrite.
- A **richer scheduling surface**, a **generalized file-attachment system**, a **configurable automation engine**, a **provider-agnostic AI layer**, **deeper dashboards and reports**, a **generalized notification system**, an **integration framework**, and a **versioned public API** — each designed completely, but built only as far as the zero-cost build discipline that has governed every prior phase allows.

The single architectural idea threading all twelve subsystems together is the **Provider Adapter Pattern** (Section 6): every subsystem that could eventually depend on a paid third party (email, file storage, AI, accounting/calendar/SMS integrations, rate-limit storage) is built today behind a small interface with a free, in-process default implementation. Funding a provider later is a config change and one new adapter file — never a redesign, never a migration, never a rewrite of a consuming feature module. This is the same discipline the Zero-Cost Build Plan already applied to Resend/Vercel Blob/Sentry, generalized into a reusable pattern instead of three one-off decisions.

**Net schema impact:** zero modification to any frozen table or enum. Nine new, additive tables and one additive, nullable column on `Job` (Section 7). No frozen table is touched.

### 2.1 Implementation Strategy

This document specifies **one unified architecture**, built and shipped **incrementally**. The roadmap in Section 29 sequences twelve subsystems across sixteen steps for the same reason Phases 4 and 5 were themselves built one module at a time — lower risk, independent verification, mergeable progress — but the step boundaries are an *implementation sequencing* concern only, not a design seam. No subsystem in Sections 10–21 was designed in isolation from the others: the Provider Adapter Pattern (Section 6), the three-authentication-plane model (Section 22.1), the additive event taxonomy (Section 6), and the schema additions (Section 7.2) are shared, cross-cutting decisions every subsystem section already assumes and builds on. Implementing Steps 1–15 out of order, or shipping a subset of them to a real client before the rest, never requires re-deriving a decision this document already made — that is the same guarantee Phase 5's own roadmap gave, and Phase 6 makes it explicit here because the surface area is larger and spans more independent teams' likely involvement (a given step may reasonably be picked up by a different engineer than the one before it). Any change discovered to be necessary mid-implementation is handled exactly per Section 1's freeze rule: it amends this document first, never the other way around.

---

## 3. Goals

1. Design a complete, implementable architecture for all twelve Phase 6 subsystems named in the authorization brief: Document Generation, Email, Customer Portal, Scheduling/Calendar, File & Media Management, Automation Engine, AI Layer, Dashboard Expansion, Reporting Expansion, Notification Expansion, Integration Layer, Public API.
2. Reuse every Phase 1–5 service exactly as built: `requireSession()`/`requireRole()`/`requireActiveUser()`/`requireCompanyScope()`, `lib/config`, `lib/numbering`, `lib/tokens.ts`, Activity/Notes/Tasks, Notifications, Search, DataTable, Export, the `features/<entity>/` vertical-slice convention, and the `ActionResult<T>` error contract.
3. Preserve the frozen database. Every schema addition is new and additive, explicitly justified, and listed in one place (Section 7).
4. Keep every paid-infrastructure dependency (email delivery, file storage, AI inference, integration credentials, rate-limit storage) behind a Provider Adapter (Section 6) with a working zero-cost default, so Phase 6 can be fully built and demoed before a single dollar is spent on infrastructure.
5. Keep the Customer Portal completely isolated from the internal application: separate auth plane, separate session cookie, separate layout, no shared session, no shared route group.
6. Produce a roadmap (Section 29) granular enough to implement, verify, and ship one subsystem at a time, lowest-risk-first, exactly as Phases 4–5 were sequenced.

## 4. Scope

In scope: Document Generation (Quote/Invoice/Job-sheet/Work-order/Receipt PDFs with branding); Email architecture (provider-agnostic, console-default); Customer Portal (view/accept/decline quotes, view/pay-status invoices, view job progress, update contact info); Scheduling/Calendar (multi-technician day/week view, drag-and-drop, conflict detection); File & Media Management (polymorphic attachments, URL-paste default, Vercel Blob upgrade path); Automation Engine (event-driven triggers now, scheduled triggers designed-for); AI Layer (provider-agnostic, off by default); Dashboard Expansion (forecasting, technician/sales performance, pipeline analytics); Reporting Expansion (profitability, utilization, CLV, aging, tax summary); Notification Expansion (channel routing, preferences); Integration Framework (registry + connection model, zero live integrations); Public API (versioned REST, API keys, rate limiting, webhooks).

## 5. Non-Goals

- No modification of any Phase 1–5 schema, route, server action, or component.
- No real money movement of any kind — Phase 6 does not integrate a payment processor; `Payment` continues to be staff-recorded exactly as Phase 5 built it. A Stripe/payment-provider integration is a **future extension point** (Section 27), not built here.
- No real third-party credentials, API keys, or webhooks are wired to a live external service in this phase — the Integration Framework is the registry and contract; specific integrations (QuickBooks, Google Calendar, Twilio, Stripe) remain unbuilt adapters until a real client need funds one.
- No live AI provider call — the AI Layer ships with `NullAIProvider` only, feature-flagged off by default.
- No live email delivery — Email ships with `ConsoleEmailProvider` only; Resend remains exactly as deferred as the Zero-Cost Build Plan already states.
- No real binary file storage — File Management ships with `UrlPasteProvider` only; Vercel Blob remains deferred.
- No scheduled/cron-driven background jobs run in this phase. Time-based automation triggers are designed for (Section 15) but execute lazily on read, exactly as `Invoice` overdue detection already does in Phase 5, until a cron runner is funded.
- No bulk row actions, no Kanban drag-and-drop on the Dashboard pipeline, no pre-computed report summary tables — these remain the Phase 5-documented future extensions; Phase 6 does not pull them forward.
- No multi-organization `User` membership, no `Role`/`Permission` tables, no custom pipeline stages — still out of scope at the Standard tier, per the frozen database document's own Section 9.

## 6. Architecture Principles

| Principle | How Phase 6 honors it |
|---|---|
| **Frozen schema as a hard constraint** | Every Phase 1–5 table, column, and enum is used exactly as it exists. All new persistence is additive: nine new tables, one new nullable column (Section 7). Nothing existing is renamed, retyped, or removed. |
| **Provider Adapter Pattern (new, generalized this phase)** | Any subsystem that *could* depend on a paid service or a swappable engine is built against a small, named interface (`EmailProvider`, `StorageProvider`, `AIProvider`, `IntegrationProvider`, `RateLimiter`, `DocumentRenderer`) with one free default implementation shipped now and one paid/alternate adapter designed-for but not installed. Swapping providers is a config/env change plus one new adapter file — never a change to the feature code that calls the interface. This is the Zero-Cost Build Plan's Resend/Blob/Sentry pattern, made into a first-class, repeatable architectural rule instead of three special cases. All six adapters follow one consistent interface shape — Section 6.1. |
| **AI is fully optional, never a dependency** | No feature anywhere in this document — including the features the AI Layer assists — requires an AI provider to be configured to function. Every AI-assisted affordance (Section 16) degrades to simply not being rendered when `aiEnabled` is false (the default for every organization), and every underlying action it would have assisted continues to work exactly as it does today, entered and saved by a human with no AI involvement at all. AI is additive convenience, never a load-bearing dependency of any workflow. |
| **Reuse, never duplicate** | Activity, Notifications, Search, DataTable, Export, Configuration Service, numbering, `lib/tokens.ts`, and every Phase 3 permission helper are consumed exactly as built. No Phase 6 module reimplements a platform service Phase 4/5 already shipped. |
| **Isolation of untrusted/external surfaces** | The Customer Portal (external, customer-controlled) and the Public API (external, third-party-controlled) are each a fully separate authentication plane from the internal staff session, with their own session/credential mechanism, their own rate-limit/abuse posture, and zero ability to reach an internal-only route or action. |
| **Server-authoritative everything, still** | Every PDF total, every automation condition, every AI suggestion, every API response is computed server-side from the same Decimal-correct, status-lifecycle-respecting data Phase 5 already produces. A PDF/API/AI output is a *read* of authoritative state, never a second source of truth for it. |
| **Additive-only event taxonomy** | New Activity `type` strings, new Notification `type` strings, and new automation trigger names are added the same way Phase 5 added `quote_revised`/`job_completed` — free-text, no enum, no migration. |
| **Zero-cost-first, designed-for-funded** | Every subsystem has a documented, named trigger condition for when it's worth paying for the upgraded provider (Section 27), so "should we fund Resend yet" becomes a checklist look-up, not a re-architecture conversation. |

### 6.1 Provider Adapter Interface Convention

Every adapter named in this document — whether it fronts a future paid service or simply a future alternate engine — follows the same four-part shape, with no exception:

1. A single, named TypeScript `interface` with exactly one primary method expressing the capability (never a grab-bag of unrelated methods).
2. Exactly one zero-cost default implementation, shipped and active today.
3. A `resolveXProvider()` (or `resolveXRenderer()`/`resolveXLimiter()`) function that selects an implementation from an environment variable or feature flag — the **only** place that branches on which implementation is active.
4. Zero conditional logic anywhere inside a consuming feature module. A feature calls the interface; it never checks which provider is configured.

| Interface | Primary method | Default (active today) | Funded/alternate (written, not wired) | Resolver | Defined in |
|---|---|---|---|---|---|
| `EmailProvider` | `send()` | `ConsoleEmailProvider` | `ResendEmailProvider` | `resolveEmailProvider()` | Section 11 |
| `StorageProvider` | `store()` | `UrlPasteProvider` | `VercelBlobProvider` | `resolveStorageProvider()` | Section 14 |
| `AIProvider` | `complete()` | `NullAIProvider` | `AnthropicProvider`/`OpenAiProvider` | `resolveAiProvider()` | Section 16 |
| `IntegrationProvider` | `connect()` | *(registry starts empty — no default needed until a first integration exists)* | per-integration adapter (QuickBooks, Stripe, etc.) | registry lookup by `provider` key | Section 20 |
| `RateLimiter` | `checkLimit()` | `DbRateLimiter` | `UpstashRateLimiter` | `resolveRateLimiter()` | Section 21 |
| `DocumentRenderer` | `render()` | `ReactPdfRenderer` | *(none named yet — interface exists so a future rendering engine is a drop-in, not a rewrite)* | `resolveDocumentRenderer()` | Section 10 |

This table is the single cross-reference for "what provider abstraction exists, and what does it default to" — every individual subsystem section (10/11/14/16/20/21) implements its row of this table and does not redefine the convention locally.

## 7. Module Breakdown

### 7.1 The twelve Phase 6 modules at a glance

| # | Module | New tables | New paid dependency (deferred) | Zero-cost V1 behavior |
|---|---|---|---|---|
| 1 | Document Generation | none | none | PDFs rendered on demand via `@react-pdf/renderer` (already in the stack), never stored |
| 2 | Email | `EmailLog` | Resend | `ConsoleEmailProvider` logs to server console + writes `EmailLog` with status `SIMULATED` |
| 3 | Customer Portal | `PortalAccessToken` | none | Staff-issued, stored, revocable link; HMAC session cookie via the existing `AUTH_SECRET` pattern |
| 4 | Scheduling & Calendar | none (+1 column: `Job.scheduledEndAt`) | none | New `/schedule` view over existing `Job` data; native HTML5 drag-and-drop, no library |
| 5 | File & Media Management | `FileAttachment` | Vercel Blob | `UrlPasteProvider` — same pattern as the existing `Organization.logoUrl` |
| 6 | Automation Engine | `AutomationRule`, `AutomationLog` | Vercel Cron (low/no-cost) | Event-driven triggers fire synchronously inside existing actions; time-based triggers evaluated lazily on read |
| 7 | AI Layer | `AiUsageLog` | Anthropic/OpenAI API | `NullAIProvider`, feature-flagged off; zero token spend until enabled |
| 8 | Dashboard Expansion | none | none | Pure read-aggregation, same as Phase 5's dashboard |
| 9 | Reporting Expansion | none | none | Pure read-aggregation, same as Phase 5's reports |
| 10 | Notification Expansion | none (+1 column: `User.notificationPreferences`) | shares Email's Resend dependency | In-app channel unchanged; email channel simulated until Email is funded |
| 11 | Integration Framework | `Integration` | varies per integration (none built) | Registry + connection-record model only; zero live adapters |
| 12 | Public API | `ApiKey`, `Webhook`, `WebhookDelivery` | Upstash Redis (optional, for high-volume rate limiting) | DB-backed sliding-window rate limiting; upgrade path documented, not required |

### 7.2 Schema additions — complete and exhaustive list

This is the **only** section of this document that touches the database, and it is the complete list — nothing in Sections 10–21 introduces persistence not listed here. Every addition is new; nothing frozen is altered.

**New `EntityType` enum values:** none. The existing five-value enum (`LEAD`/`QUOTE`/`JOB`/`CUSTOMER`/`INVOICE`) already covers every polymorphic reference Phase 6 needs (Section 7.2.2, `FileAttachment`; Section 7.2.5, `AutomationRule`).

**New justified column:**
```
Job.scheduledEndAt   DateTime?   // additive, nullable — enables real calendar event
                                  // blocks and conflict detection (Section 13).
                                  // Job.scheduledDate (existing, frozen) remains the
                                  // start time; this is the only new field on any
                                  // frozen table in Phase 6.

User.notificationPreferences   Json?   // additive, nullable — null means "all
                                         // channels enabled," so no backfill is
                                         // semantically required for existing rows.
                                         // Shape: { inApp: boolean, email: boolean,
                                         // mutedTypes: string[] }. Justified the same
                                         // way Phase 4 justified its two additive
                                         // Organization columns: a real column, not
                                         // JSON-on-Organization, because it is
                                         // per-user state, not per-tenant config.
```

#### 7.2.1 `EmailLog`
```
model EmailLog {
  id                String       @id @default(uuid()) @db.Uuid
  organizationId    String       @db.Uuid
  organization      Organization @relation(fields: [organizationId], references: [id])
  toEmail           String
  fromEmail         String
  subject           String
  templateType      String                  // "quote_sent" | "invoice_sent" | "payment_confirmation" | ...
  relatedEntityType EntityType?
  relatedEntityId   String?      @db.Uuid
  status            String       @default("QUEUED")  // QUEUED | SIMULATED | SENT | DELIVERED | BOUNCED | FAILED
  providerMessageId String?                  // null under ConsoleEmailProvider
  attempts          Int          @default(0)
  lastError         String?
  sentAt            DateTime?
  createdAt         DateTime     @default(now())

  @@index([organizationId, status, createdAt])
  @@index([organizationId, relatedEntityType, relatedEntityId])
}
```
Free-text `status`/`templateType` strings, consistent with how `Activity.type`/`Notification.type` are already free text rather than enums for an open-ended, additive taxonomy.

#### 7.2.2 `FileAttachment`
```
model FileAttachment {
  id             String       @id @default(uuid()) @db.Uuid
  organizationId String       @db.Uuid
  organization   Organization @relation(fields: [organizationId], references: [id])
  entityType     EntityType?            // nullable — null = organization-level file
                                          // ("Company documents"), mirroring Task's
                                          // existing nullable entityType convention
  entityId       String?      @db.Uuid
  url            String                 // pasted URL today; a real Vercel Blob URL
                                          // tomorrow — identical column, zero migration
  fileName       String
  mimeType       String?
  sizeBytes      Int?                   // nullable — URL-paste mode often can't know this
  category       String                 // PHOTO | BEFORE | AFTER | DOCUMENT | ATTACHMENT
  uploadedById   String       @db.Uuid
  uploadedBy     User         @relation(fields: [uploadedById], references: [id])
  createdAt      DateTime     @default(now())

  @@index([organizationId, entityType, entityId])
}
```
Same polymorphic shape as `Activity`/`Note`/`Task` — same accepted trade-off already documented in the frozen database architecture (Section 8 of that document): `entityId` is not a DB-enforced FK. No new trade-off is introduced; an existing, already-accepted one is extended.

#### 7.2.3 `ApiKey`
```
model ApiKey {
  id             String       @id @default(uuid()) @db.Uuid
  organizationId String       @db.Uuid
  organization   Organization @relation(fields: [organizationId], references: [id])
  name           String                 // owner-given label, e.g. "Zapier integration"
  keyPrefix      String                 // first 8 chars shown in UI, e.g. "qf_live_a1b2"
  hashedKey      String                 // bcrypt hash of the full key — never store plaintext
  scopes         String[]               // e.g. ["leads:read", "quotes:write"] — see Section 21
  lastUsedAt     DateTime?
  isActive       Boolean      @default(true)
  createdById    String       @db.Uuid
  createdBy      User         @relation(fields: [createdById], references: [id])
  createdAt      DateTime     @default(now())
  revokedAt      DateTime?

  @@index([organizationId, isActive])
}
```
`scopes` is the schema's first native Postgres array column. Justified the same way enums are justified in the frozen schema (a closed, small, well-known, app-validated set of strings) — chosen over `Json` here only because scope-membership queries (`scopes: { has: "leads:read" }`) are simpler and more indexable than a JSON-array contains check, with no other behavioral difference.

#### 7.2.4 `Webhook` and `WebhookDelivery`
```
model Webhook {
  id                String       @id @default(uuid()) @db.Uuid
  organizationId    String       @db.Uuid
  organization      Organization @relation(fields: [organizationId], references: [id])
  url               String
  secret            String                 // HMAC signing secret, shown once at creation
  subscribedEvents  String[]               // e.g. ["quote.accepted", "invoice.paid"]
  isActive          Boolean      @default(true)
  createdById       String       @db.Uuid
  createdAt         DateTime     @default(now())

  @@index([organizationId, isActive])
}

model WebhookDelivery {
  id                String   @id @default(uuid()) @db.Uuid
  webhookId         String   @db.Uuid
  webhook           Webhook  @relation(fields: [webhookId], references: [id])
  eventType         String
  payload           Json
  status            String   @default("PENDING")  // PENDING | SUCCESS | FAILED
  responseStatusCode Int?
  attempts          Int      @default(0)
  lastAttemptAt     DateTime?
  nextRetryAt       DateTime?
  createdAt         DateTime @default(now())

  @@index([webhookId, status, nextRetryAt])
}
```

#### 7.2.5 `AutomationRule` and `AutomationLog`
```
model AutomationRule {
  id              String       @id @default(uuid()) @db.Uuid
  organizationId  String       @db.Uuid
  organization    Organization @relation(fields: [organizationId], references: [id])
  name            String
  triggerType     String                  // e.g. "quote.accepted", "invoice.overdue"
  triggerEntity   EntityType?
  conditions      Json                    // e.g. { field: "total", op: "gte", value: 5000 }
  actions         Json                    // ordered array: [{ type: "send_notification", params: {...} }, ...]
  isActive        Boolean      @default(true)
  createdById     String       @db.Uuid
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([organizationId, triggerType, isActive])
}

model AutomationLog {
  id           String   @id @default(uuid()) @db.Uuid
  ruleId       String   @db.Uuid
  rule         AutomationRule @relation(fields: [ruleId], references: [id])
  entityType   EntityType?
  entityId     String?  @db.Uuid
  status       String              // SUCCESS | FAILED | SKIPPED
  resultMessage String?
  executedAt   DateTime @default(now())

  @@index([ruleId, executedAt])
}
```

#### 7.2.6 `Integration`
```
model Integration {
  id             String       @id @default(uuid()) @db.Uuid
  organizationId String       @db.Uuid
  organization   Organization @relation(fields: [organizationId], references: [id])
  provider       String                  // "quickbooks" | "google_calendar" | "stripe" | ...
  status         String       @default("NOT_CONNECTED")  // NOT_CONNECTED | CONNECTED | ERROR
  config         Json?                   // non-secret config only — see Section 20 on credential handling
  connectedAt    DateTime?
  lastSyncAt     DateTime?
  createdById    String       @db.Uuid
  createdAt      DateTime     @default(now())

  @@unique([organizationId, provider])
}
```

#### 7.2.7 `PortalAccessToken`
```
model PortalAccessToken {
  id             String       @id @default(uuid()) @db.Uuid
  organizationId String       @db.Uuid
  organization   Organization @relation(fields: [organizationId], references: [id])
  customerId     String       @db.Uuid
  customer       Customer     @relation(fields: [customerId], references: [id])
  tokenHash      String                  // bcrypt hash of the issued token — never store plaintext
  label          String?                 // e.g. "Sent via text 6/28"
  expiresAt      DateTime?
  revokedAt      DateTime?
  lastUsedAt      DateTime?
  createdById    String       @db.Uuid
  createdAt      DateTime     @default(now())

  @@index([organizationId, customerId])
}
```
This is the **stored, revocable** token Phase 5's own implementation report explicitly flagged as a future extension ("a stored, revocable share token if a client needs to invalidate a sent quote's link independently of its status"). It is new, additive infrastructure for the new Customer Portal surface; it does not modify, replace, or revoke the existing Phase 5 per-Quote HMAC share link (`lib/tokens.ts`), which continues to work exactly as frozen for the "share a single quote" use case. The Portal is the new "ongoing relationship" surface; the single-quote link remains the "send this one document" surface. Both coexist (Section 12.10).

#### 7.2.8 `AiUsageLog`
```
model AiUsageLog {
  id             String       @id @default(uuid()) @db.Uuid
  organizationId String       @db.Uuid
  organization   Organization @relation(fields: [organizationId], references: [id])
  feature        String                  // "quote_draft" | "email_draft" | "lead_priority" | ...
  provider       String                  // "null" | "anthropic" | "openai"
  tokensUsed     Int?
  costEstimate   Decimal?     @db.Decimal(10, 4)
  createdById    String       @db.Uuid
  createdAt      DateTime     @default(now())

  @@index([organizationId, createdAt])
}
```
Written by `NullAIProvider` too (with `tokensUsed = 0`, `costEstimate = 0`), so the table — and any future cost-reporting screen — is correct from day one, with no separate "did we have logging before AI was enabled" gap.

### 7.3 What is explicitly NOT added

Consistent with the frozen database document's own "what should not be added" discipline: no `Role`/`Permission` tables, no soft delete, no `AuditLog`, no `CustomerContact`, no `ServiceCategory` nesting, no `QuoteVersionSnapshot`, no multi-organization `User` membership. A `Document` table (storing rendered PDFs as binary/blob rows) is deliberately **not** added — PDFs remain ephemeral, server-rendered per request from live `Quote`/`Invoice`/`Job` data, exactly extending the frozen database document's own Section 7 reasoning ("a PDF is generated on demand... never stored as a binary file").
## 8. Folder Structure

Extends the Phase 5 tree additively. Every existing path is unchanged; every new path is new.

```
src/
├── app/
│   ├── (dashboard)/                      # frozen Phase 3–5 staff app, unchanged
│   │   ├── ...                           # leads/, customers/, quotes/, jobs/, invoices/, catalog/, dashboard/, reports/
│   │   ├── schedule/page.tsx             # NEW — multi-technician day/week calendar (Section 13)
│   │   └── settings/
│   │       ├── automations/page.tsx      # NEW — Section 15
│   │       ├── integrations/page.tsx     # NEW — Section 20
│   │       ├── api-keys/page.tsx         # NEW — Section 21
│   │       └── ai/page.tsx               # NEW — Section 16 (feature-flag toggle + usage view)
│   ├── (portal)/                         # NEW — entirely separate route group, separate layout
│   │   ├── layout.tsx                    # no shared nav/shell with (dashboard)
│   │   ├── portal/
│   │   │   ├── login/page.tsx            # token redemption
│   │   │   ├── page.tsx                  # portal home — quotes/invoices/jobs summary
│   │   │   ├── quotes/[id]/page.tsx
│   │   │   ├── invoices/[id]/page.tsx
│   │   │   ├── jobs/[id]/page.tsx
│   │   │   └── account/page.tsx          # update contact info
│   ├── api/
│   │   ├── lead-capture/route.ts         # frozen, unchanged
│   │   ├── v1/                           # NEW — Public API (Section 21)
│   │   │   ├── leads/route.ts
│   │   │   ├── leads/[id]/route.ts
│   │   │   ├── quotes/route.ts
│   │   │   ├── quotes/[id]/route.ts
│   │   │   ├── jobs/route.ts
│   │   │   ├── invoices/route.ts
│   │   │   ├── customers/route.ts
│   │   │   └── webhooks/route.ts         # register/list webhooks
│   │   └── webhooks/dispatch/route.ts    # NEW — internal delivery worker endpoint (Section 20)
├── features/
│   ├── ...                               # leads/, customers/, quotes/, quote-builder/, jobs/, invoices/, catalog/,
│   │                                      # dashboard/, reports/, activity/, notifications/, search/, tables/,
│   │                                      # export/, layout/ — all Phase 4–5, unchanged
│   ├── documents/                        # NEW — Section 10
│   │   ├── templates/                    # one .tsx per document type
│   │   │   ├── QuotePdf.tsx
│   │   │   ├── InvoicePdf.tsx
│   │   │   ├── JobSheetPdf.tsx
│   │   │   ├── WorkOrderPdf.tsx
│   │   │   └── ReceiptPdf.tsx
│   │   └── render.ts                     # renderDocument(type, entityId) → Buffer
│   ├── email/                            # NEW — Section 11
│   │   ├── providers/
│   │   │   ├── console-provider.ts
│   │   │   └── resend-provider.ts        # written, NOT wired — Section 11.13
│   │   ├── templates/                    # one function per template, returns { subject, html, text }
│   │   ├── actions.ts                    # sendTemplatedEmail()
│   │   └── queries.ts                    # getEmailLogForEntity()
│   ├── customer-portal/                  # NEW — Section 12
│   │   ├── components/
│   │   ├── actions.ts                    # issuePortalToken(), revokePortalToken(), redeemPortalToken(),
│   │   │                                  # acceptQuoteFromPortal(), updateContactInfo()
│   │   ├── queries.ts                    # getPortalSession(), getPortalSummary()
│   │   └── session.ts                    # sign/verify the portal session cookie
│   ├── schedule/                         # NEW — Section 13
│   │   ├── components/                   # CalendarGrid, JobEventCard, ConflictBadge
│   │   ├── actions.ts                    # rescheduleJob(), checkConflicts()
│   │   └── queries.ts                    # getScheduleForRange()
│   ├── files/                            # Phase 4, EXTENDED (Section 14) — was a single
│   │   │                                  # logoUrl/FileRef pattern; now also owns FileAttachment
│   │   ├── components/                   # FileUrlInput (unchanged), FileAttachmentList (NEW)
│   │   ├── providers/
│   │   │   ├── url-paste-provider.ts     # NEW
│   │   │   └── vercel-blob-provider.ts   # written, NOT wired — Section 14.13
│   │   ├── actions.ts                    # attachFile(), removeAttachment() — NEW
│   │   └── queries.ts                    # getAttachmentsForEntity() — NEW
│   ├── automation/                       # NEW — Section 15
│   │   ├── components/                   # RuleBuilder, RuleList, AutomationLogTable
│   │   ├── engine.ts                     # evaluateTriggers(), runActions()
│   │   ├── actions.ts                    # createRule(), updateRule(), deactivateRule()
│   │   └── queries.ts                    # getRulesForTrigger(), getAutomationLog()
│   ├── ai/                               # NEW — Section 16
│   │   ├── providers/
│   │   │   ├── null-provider.ts
│   │   │   └── anthropic-provider.ts     # written, NOT wired — Section 16.13
│   │   ├── components/                   # AiSuggestButton, AiDraftPanel
│   │   └── actions.ts                    # generateQuoteDraft(), draftEmail(), summarizeJob()
│   ├── integrations/                     # NEW — Section 20
│   │   ├── components/
│   │   ├── registry.ts                   # IntegrationProvider registry
│   │   ├── actions.ts                    # connectIntegration(), disconnectIntegration()
│   │   └── queries.ts                    # getIntegrationsForOrganization()
│   ├── api-keys/                         # NEW — Section 21
│   │   ├── components/
│   │   ├── actions.ts                    # createApiKey(), revokeApiKey()
│   │   └── queries.ts
│   └── webhooks/                         # NEW — Section 20/21
│       ├── components/
│       ├── actions.ts                    # createWebhook(), deleteWebhook()
│       ├── dispatch.ts                   # signPayload(), deliverWebhook(), retry policy
│       └── queries.ts
├── components/
│   ├── ui/                               # unchanged
│   └── shared/                           # unchanged, + StatusBadge/MoneyDisplay reused by documents/email templates
├── lib/
│   ├── db.ts, auth.ts, permissions.ts, logger.ts        # unchanged
│   ├── tokens.ts                         # unchanged — Quote share-link HMAC, frozen Phase 5
│   ├── numbering/, config/                # unchanged
│   ├── pdf/                              # NEW — shared @react-pdf/renderer primitives
│   │   ├── theme.ts                      # reads branding from lib/config, not hardcoded
│   │   └── components/                   # PdfHeader, PdfFooter, PdfTable — shared across all 5 templates
│   ├── rate-limit/                       # NEW — Section 21
│   │   ├── db-rate-limiter.ts            # V1 default
│   │   └── upstash-rate-limiter.ts       # written, NOT wired — Section 21.13
│   └── feature-flags.ts                  # NEW — thin reader over Organization.settings.featureFlags
│                                          # (Section 4's existing flag mechanism), one flag per
│                                          # deferred provider: aiEnabled, emailProviderEnabled, etc.
└── utils/
```

`features/quote-builder/` and the Phase 5 module folders are listed once above as "unchanged" and not repeated per-file — see `QuoteFlow_Phase5_Business_Architecture.md` Section 9 for their full contents.

## 9. Navigation Changes

Extends the Phase 5 sidebar order (**Dashboard → Leads → Quotes → Jobs → Invoices → Customers → Reports → Catalog → Settings**) additively. No existing item is removed, renamed, or reordered.

| Change | Item | Position | Visibility |
|---|---|---|---|
| New top-level item | **Schedule** | Inserted after Jobs | `OWNER`, `STAFF` (full multi-technician view); `FIELD` sees only their own day/week, same scoping rule as `/jobs` |
| New Settings sub-item | **Automations** | Settings → Automations | `OWNER` only |
| New Settings sub-item | **Integrations** | Settings → Integrations | `OWNER` only |
| New Settings sub-item | **API Keys** | Settings → API Keys | `OWNER` only |
| New Settings sub-item | **AI Features** | Settings → AI (toggle + usage) | `OWNER` only |
| No nav entry | Customer Portal | N/A — separate base path `/portal/*`, own layout, never appears in the staff sidebar | Customers only, via portal session |
| No nav entry | Public API | N/A — `/api/v1/*`, no UI surface beyond the Settings → API Keys management screen | Third-party API consumers, via API key |

`/jobs/calendar` (Phase 5, frozen) is unchanged and remains reachable from the Jobs module exactly as built — it is a simple month grid scoped to one module's data. The new `/schedule` route (Section 13) is additive, richer, multi-technician, and does not replace or alter it.
## 10. Document Generation Architecture

### 10.1 Executive Overview
Turns existing `Quote`, `Invoice`, `Job`, and `Organization` data into branded, professional PDFs, rendered on demand at request time, never stored as a binary file — a direct, generalized extension of the frozen database document's own Section 7 design ("a PDF is generated on demand... directly from the Quote's current line items and totals... never stored as a binary file"), now applied to five document types instead of one.

### 10.2 Responsibilities
Render Quote PDFs, Invoice PDFs, Job Sheets, Work Orders, and Payment Receipts, each with company branding (logo, colors, name pulled from `lib/config`), watermarks (e.g., "DRAFT" / "VOID"), multi-page support for long line-item lists, and a template system that lets a sixth document type be added later without touching the first five.

### 10.3 Data Model
None. Zero schema impact (Section 7.3). Every field a document needs already exists on `Quote`/`QuoteItem`/`Invoice`/`Job`/`Organization`.

### 10.4 Folder Structure
`features/documents/templates/*.tsx` (one component per document type) + `lib/pdf/` (shared `PdfHeader`/`PdfFooter`/`PdfTable` primitives and a `theme.ts` that reads `lib/config`'s branding section). See Section 8.

### 10.5 Components
Each template is a pure `@react-pdf/renderer` component tree: `<QuotePdf quote={...} organization={...} />`, etc. No client-side component — documents render server-side only, then stream to the browser as a download or inline view.

### 10.6 Server Actions & Services
Per the convention in Section 6.1, rendering is abstracted behind a `DocumentRenderer` interface rather than calling `@react-pdf/renderer` directly from `render.ts` — today there is exactly one implementation, but the indirection means a future rendering engine (e.g., a headless-browser HTML-to-PDF approach, or an external rendering API) is a new adapter file, never a change to every template or call site.
```ts
// lib/pdf — the interface and the one implementation active today
interface DocumentRenderer {
  render(element: ReactElement): Promise<Buffer>;
}

class ReactPdfRenderer implements DocumentRenderer {
  async render(element: ReactElement) { return renderToBuffer(element); }   // @react-pdf/renderer, already in the stack
}

function resolveDocumentRenderer(): DocumentRenderer { return new ReactPdfRenderer(); }  // only branch point if a second renderer is ever added

// features/documents/render.ts
export async function renderDocument(
  type: "quote" | "invoice" | "job-sheet" | "work-order" | "receipt",
  entityId: string,
): Promise<Buffer> {
  const { organizationId } = await requireCompanyScope();
  const data = await loadEntityScoped(type, entityId, organizationId); // throws if not found/wrong org
  const config = await getCompanyConfig(organizationId);               // lib/config, Phase 4
  return resolveDocumentRenderer().render(resolveTemplate(type)({ data, config }));
}
```
A thin route handler (`/api/documents/[type]/[id]/route.ts` — internal, session-gated, not part of the Public API) calls `renderDocument()` and streams the buffer with `Content-Type: application/pdf`. The Customer Portal (Section 12) calls the same function under the portal session's own scope check, not a separate render path.

### 10.7 Data Flow
`Staff or portal request → requireCompanyScope() / portal session check → load entity (org-scoped) → load branding config → render → stream PDF` — a pure read pipeline, no write, no side effect, no Activity log entry (rendering a PDF is not a business event).

### 10.8 Permission Model
Any role that can view the underlying entity can render its PDF: `OWNER`/`STAFF` for all five types; `FIELD` for Job Sheets/Work Orders on their own assigned Jobs only (same scoping as the Job module itself); the Customer Portal session for that customer's own Quotes/Invoices/Jobs only (Section 12.8).

### 10.9 Security Considerations
The render route re-derives `organizationId`/`customerId` from the session/portal-session — it never trusts an `entityId` alone. A staff member or portal customer cannot render a document belonging to another organization or another customer by guessing an ID, since the underlying `loadEntityScoped()` query is `WHERE id = ? AND organizationId = ?` (and, for the portal, `AND customerId = ?`), identical in spirit to every other Phase 5 query.

### 10.10 Error Handling & Validation
If the entity doesn't exist or isn't in this session's scope, the route returns a 404, not a 403 (never confirm existence of another org's record). Render failures (a template throwing) are logged via `lib/logger.ts` and surfaced as a generic "Could not generate this document" error — no raw rendering stack trace reaches the client.

### 10.11 Performance & Caching Strategy
No caching — these are low-frequency, on-demand, single-record renders (a customer opens their one invoice; staff prints one work order), not a hot list-page query. Rendering is CPU-bound, not DB-bound, so it does not compete with the Phase 5 caching rules (Section 23 carries this forward).

### 10.12 Testing Strategy
Snapshot tests per template (a fixed sample `Quote`/`Invoice` renders byte-identical PDF structure across runs); an integration test confirming a `FIELD` user cannot render a Job Sheet for a Job not assigned to them; a portal-scope test confirming a customer cannot render another customer's invoice by ID substitution.

### 10.13 Future Extension Points
A sixth document type (e.g., a Statement-of-Account PDF) is a new `features/documents/templates/*.tsx` file plus one new `type` literal — no change to the render pipeline, the route, or any existing template. A future rendering engine swap is a new `DocumentRenderer` implementation plus a one-line change to `resolveDocumentRenderer()` (Section 10.6) — no change to any template or call site. Stored, versioned document snapshots (so a sent Quote's PDF is byte-identical even after the Quote is later revised) are an explicit future option once a real client need for that surfaces, traded off against the zero-storage-cost design chosen here.

---

## 11. Email Architecture

### 11.1 Executive Overview
A complete, provider-agnostic communication architecture that ships today with **zero email actually sent** (consistent with the Zero-Cost Build Plan's existing "Quote Sent = a database status flip, no email actually sent" posture) and upgrades to real delivery via Resend by installing one adapter and flipping one environment flag — no change to any feature module that triggers an email.

### 11.2 Responsibilities
Define the single `EmailProvider` interface every email-triggering event calls; implement email history, retry, and delivery-tracking against that interface regardless of which provider is active; define the template set (quote sent, invoice sent, payment confirmation, reminder, job notification) as pure functions independent of the provider.

### 11.3 Data Model
`EmailLog` (Section 7.2.1) — the single source of truth for "was this email attempted, and what happened."

### 11.4 Folder Structure
`features/email/{providers/, templates/, actions.ts, queries.ts}`. See Section 8.

### 11.5 Components
None client-facing in V1 beyond an `EmailHistoryList` component on each entity's detail page (reads `EmailLog` filtered by `relatedEntityType`/`relatedEntityId`) — a new tab alongside the existing Activity/Notes/Tasks tabs (Section 17 carries the same `EntityDetailTabs` shell forward, unmodified).

### 11.6 Server Actions & Services
```ts
// features/email/providers — the interface every provider implements
interface EmailProvider {
  send(message: { to: string; from: string; subject: string; html: string; text: string }):
    Promise<{ success: boolean; providerMessageId?: string; error?: string }>;
}

// features/email/actions.ts
export async function sendTemplatedEmail(input: {
  organizationId: string;
  templateType: string;
  relatedEntityType?: EntityType;
  relatedEntityId?: string;
  to: string;
}) {
  const provider = resolveEmailProvider();       // reads feature flag — Section 11.13
  const { subject, html, text } = await renderTemplate(input.templateType, input);
  const log = await db.emailLog.create({ data: { ...input, fromEmail: getOrgFromAddress(input.organizationId), subject, status: "QUEUED" } });
  const result = await provider.send({ to: input.to, from: log.fromEmail, subject, html, text });
  await db.emailLog.update({ where: { id: log.id }, data: {
    status: result.success ? (provider.name === "console" ? "SIMULATED" : "SENT") : "FAILED",
    providerMessageId: result.providerMessageId, lastError: result.error, sentAt: result.success ? new Date() : null,
    attempts: { increment: 1 },
  }});
  return log;
}
```
`ConsoleEmailProvider.send()` logs the full rendered email to the server console via `lib/logger.ts` and returns `{ success: true }` — every call site behaves identically whether or not real delivery is active.

### 11.7 Data Flow
`Triggering event (quote sent, invoice issued, payment recorded, automation action) → sendTemplatedEmail() → render template → write EmailLog (QUEUED) → provider.send() → update EmailLog (terminal status)`. Retry (Section 11.10) re-enters this flow from the `EmailLog` row, not from the original event, so a retried email doesn't need the original business context re-derived.

### 11.8 Permission Model
Email is never triggered directly by a client request — only server-side, from inside an already-permission-checked action (e.g., `sendQuote`, `recordPayment`) or from the Automation Engine (Section 15). There is no standalone "send arbitrary email" action exposed anywhere, by design — this closes an entire class of abuse (spam relay via the app) before it can exist.

### 11.9 Security Considerations
`from` addresses are derived from `lib/config`, never client-supplied. Email bodies are rendered from typed template functions with escaped interpolation, never raw string concatenation of user input — closing template-injection as a category, the email equivalent of the SQL-injection discipline Prisma already provides.

### 11.10 Error Handling & Validation
A `FAILED` `EmailLog` row is eligible for retry: a simple capped exponential backoff (`attempts < 5`, next attempt at `2^attempts` minutes) re-invokes `provider.send()` with the already-rendered content stored... not stored — rendered fresh from `relatedEntityType`/`relatedEntityId` at retry time, since storing rendered HTML would be the "store the document" anti-pattern this architecture otherwise avoids (Section 7.3). The retry loop itself is part of the Automation Engine's time-based trigger category (Section 15.2) once a cron runner exists; until then, retries are a manual "Retry" button on the `EmailHistoryList` row, which is sufficient at zero-cost-phase volume.

### 11.11 Performance & Caching Strategy
No caching — `EmailLog` writes are infrequent, low-volume events, not a hot read path.

### 11.12 Testing Strategy
Unit test every template function for correct interpolation and no unescaped user input; integration test confirming `sendTemplatedEmail()` always writes exactly one `EmailLog` row regardless of provider outcome; a provider-swap test confirming `ConsoleEmailProvider` and a mock `ResendEmailProvider` produce identical `EmailLog` shapes (only `status`/`providerMessageId` differ).

### 11.13 Future Extension Points — funding trigger
**Adopt Resend when:** a real pilot client needs an actual quote/invoice email to leave the building, exactly the trigger already named in the Zero-Cost Build Plan and echoed in the Phase 5 Implementation Report's Recommendation #2. At that point: install `resend`, implement `ResendEmailProvider.send()` against the same interface, set `EMAIL_PROVIDER=resend` + `RESEND_API_KEY`, done — zero change to `sendTemplatedEmail()`, zero change to any template, zero change to any call site. Resend's own delivery webhooks (bounce/open/click) become a new `/api/webhooks/resend/route.ts` that updates `EmailLog.status` — additive, not a redesign.

---

## 12. Customer Portal Architecture

### 12.1 Executive Overview
A second, fully isolated web surface where a `Customer` (not a `User`) can view their Quotes, accept/decline, view Invoices and payment history, track Job progress, and update their own contact information — without ever touching the internal staff application's session, layout, or routes.

### 12.2 Responsibilities
Issue and revoke stored portal access tokens; authenticate a portal session from a redeemed token; scope every portal read/write to exactly one `customerId` within one `organizationId`; expose a read+limited-write surface over Quote/Invoice/Job/Customer that never lets a portal session reach an internal route.

### 12.3 Data Model
`PortalAccessToken` (Section 7.2.7). No change to `Customer`, `Quote`, `Invoice`, or `Job` — the portal reads them exactly as Phase 5 left them and writes only `Customer.email`/`phone`/`address` (already-existing, nullable fields) via the contact-update action.

### 12.4 Folder Structure
`features/customer-portal/{components/, actions.ts, queries.ts, session.ts}`, plus the entirely separate `app/(portal)/` route group (Section 8) with its own `layout.tsx`.

### 12.5 Components
`PortalNav` (Quotes/Invoices/Jobs/Account — four links, nothing else), `PortalQuoteView` (read + Accept/Decline buttons), `PortalInvoiceView` (read-only, balance + payment history), `PortalJobTimeline` (status + completion notes, read-only), `PortalContactForm`. None of these import from `features/leads`, `features/quotes`, etc.'s internal-app components — they are new, portal-specific components built against the same underlying data, to guarantee zero accidental coupling to an internal-only UI affordance (e.g., a STAFF-only edit button).

### 12.6 Server Actions & Services
```ts
// features/customer-portal/actions.ts — issued from the STAFF-facing Customer detail page
export async function issuePortalToken(customerId: string, label?: string, expiresInDays = 90) {
  const { organizationId } = await requireCompanyScope();
  await requireRole(["OWNER", "STAFF"]);
  const token = generateRandomToken(32);                  // crypto.randomBytes, not lib/tokens.ts's HMAC
  const tokenHash = await bcrypt.hash(token, 10);
  await db.portalAccessToken.create({ data: { organizationId, customerId, tokenHash, label, expiresAt: addDays(new Date(), expiresInDays), createdById: (await requireSession()).userId } });
  return `${PORTAL_BASE_URL}/portal/login?token=${token}`; // shown once, staff copies and sends out-of-band
}

// features/customer-portal/session.ts
export async function redeemPortalToken(rawToken: string) {
  const candidates = await db.portalAccessToken.findMany({ where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  const match = await firstBcryptMatch(candidates, rawToken); // constant-time-conscious compare loop
  if (!match) return null;
  await db.portalAccessToken.update({ where: { id: match.id }, data: { lastUsedAt: new Date() } });
  return signPortalSessionCookie({ customerId: match.customerId, organizationId: match.organizationId }); // reuses AUTH_SECRET
}
```
Every subsequent portal action calls `requirePortalSession()` (the portal's own analog to `requireSession()`), which decodes the portal cookie and returns `{ customerId, organizationId }` — never a `userId`, never a `role`. There is no code path by which a portal session can call an internal-app server action: the actions live in a different module and never import `requireSession`/`requireRole`.

### 12.7 Data Flow
`Staff issues token (Customer detail page) → customer receives link out-of-band (text/email, staff's own channel until Email is funded) → customer opens /portal/login?token=... → redeemPortalToken() → signed portal cookie set → every /portal/* page calls requirePortalSession() → scoped reads/writes`.

### 12.8 Permission Model
A single, flat permission model — not role-based, because there are no roles on the customer side: a valid portal session can read its own `Customer`'s Quotes/Invoices/Jobs and write only its own `Customer.email`/`phone`/`address`. It cannot read or write any other customer's data, any Lead, any Catalog item, any internal report, or anything outside its own `customerId`. Quote Accept/Decline from the portal calls the **same** `acceptQuote()`/`declineQuote()` actions Section 22 of the Phase 5 document already defines — re-pointed to accept a portal-session identity instead of a staff identity as the caller, with the existing conditional-update concurrency guarantee unchanged.

### 12.9 Security Considerations
- Tokens are stored **hashed** (bcrypt), never plaintext — a database read alone cannot impersonate a customer.
- Tokens are **revocable** (`revokedAt`) and **expirable** (`expiresAt`), directly satisfying the Phase 5 Implementation Report's Recommendation #5.
- The portal session cookie is a separate, distinctly named cookie from the staff session, signed with the same `AUTH_SECRET` but a different payload shape and a shorter, configurable lifetime (default 30 days, renewed on activity) — a leaked portal cookie cannot be replayed against the internal app, and vice versa, because `requireSession()` and `requirePortalSession()` decode and validate disjoint claim shapes.
- The portal `middleware.ts` rule (a new, additive entry in the existing route-classification map, Phase 3 §11.2) treats every `/portal/*` path as its own bucket: no valid staff session grants portal access, and no valid portal session grants staff-app access — crossing the boundary always requires re-authenticating on the other side.
- Activity logging for portal-driven events (`portal_contact_updated`, reusing `quote_accepted`/`quote_declined` for portal-originated accept/decline) follows the exact attribution pattern Phase 5 already established for customer-driven events: `createdById` falls back to the record's `assignedToId`/`createdById` (Quote, Job) since `Activity.createdById` is a real FK to `User` and a `Customer` is never a valid value for it. For the one event tied to `Customer` itself (`portal_contact_updated`, which has no natural staff-owner field), `createdById` falls back deterministically to the organization's earliest-created `OWNER` — a documented, accepted attribution gap, consistent in spirit with how the frozen database document already calls the polymorphic `Activity`/`Note` FK trade-off "accepted deliberately" rather than silently glossed over.

### 12.10 Error Handling & Validation
An invalid, expired, or revoked token redeems to a generic "This link is no longer valid — please contact [Organization name] for a new one" message, never distinguishing *why* (expired vs. revoked vs. never existed) to avoid leaking enumerable state. Contact-info updates run through the same Zod schema the internal Customer module already uses for `email`/`phone`/`address` (Section 28 of the Phase 5 document), imported and reused, not duplicated.

### 12.11 Performance & Caching Strategy
No caching — portal traffic is low-volume (one customer, occasionally) relative to internal staff traffic, and correctness (always showing the live Quote/Invoice/Job state) matters more than shaving a query.

### 12.12 Testing Strategy
Token issuance/redemption/expiry/revocation unit tests; an integration test confirming a redeemed token cannot read another organization's or another customer's data by ID substitution on any portal route; a security test confirming no portal session can successfully call any internal-app server action (import-boundary test, not just a runtime check); an E2E flow: staff issues link → customer opens it → accepts a Quote → Job appears in the internal app exactly as the existing public-link flow already produces.

### 12.13 Future Extension Points
Email-delivered portal links (auto-send `issuePortalToken()`'s output via `sendTemplatedEmail()` the moment Resend is funded — zero new code, just one new call site); a "magic link, no staff action required" self-service login (`enter your email` → if a `Customer` matches, redeem a freshly-issued token) once email delivery is real; online payment from the portal once a payment-provider integration (Section 20) exists — explicitly not built here, since it would require real money movement, which Section 5 places out of scope.

---

## 13. Scheduling Architecture

### 13.1 Executive Overview
A richer, multi-technician calendar surface (`/schedule`) layered on top of the exact same `Job` data the frozen Phase 5 `/jobs/calendar` month grid already reads — additive, not a redesign, per Section 1's freeze rule.

### 13.2 Responsibilities
Day/week views across all `FIELD` users at once (not just one Job list); drag-and-drop rescheduling; basic overlap/conflict detection per technician; a daily agenda view; future calendar-provider integration points (Section 20).

### 13.3 Data Model
One additive, nullable column: `Job.scheduledEndAt` (Section 7.2). `Job.scheduledDate` (existing) is treated as the event start; `scheduledEndAt` is optional — a Job without it renders as a point-in-time marker (today's existing behavior, unchanged for any Job created before this column existed or any staff member who doesn't set it).

### 13.4 Folder Structure
`features/schedule/{components/, actions.ts, queries.ts}`. See Section 8.

### 13.5 Components
`CalendarGrid` (day/week toggle, one column per `FIELD` user), `JobEventCard` (draggable block, color-coded by `Job.status`, reusing the existing `<StatusBadge>` color map), `ConflictBadge` (renders when `checkConflicts()` returns an overlap), `DailyAgendaList` (flat, sorted list view of the same data for mobile/FIELD use, extending the existing FIELD-scoped mobile pattern from the Jobs module).

### 13.6 Server Actions & Services
```ts
// features/schedule/queries.ts
export async function getScheduleForRange(start: Date, end: Date, technicianId?: string) {
  const { organizationId } = await requireCompanyScope();
  const session = await requireSession();
  const scopeFilter = session.role === "FIELD" ? { assignedToId: session.userId } : technicianId ? { assignedToId: technicianId } : {};
  return db.job.findMany({ where: { organizationId, scheduledDate: { gte: start, lte: end }, ...scopeFilter }, include: { customer: true, assignedTo: true } });
}

// features/schedule/actions.ts
export async function rescheduleJob(jobId: string, newStart: Date, newEnd?: Date) {
  await requireRole(["OWNER", "STAFF"]);          // FIELD cannot reschedule — identical rule to Section 20 of the Phase 5 document
  const { organizationId } = await requireCompanyScope();
  const conflicts = await checkConflicts(jobId, newStart, newEnd, organizationId);
  if (conflicts.length) return { success: false, error: "Scheduling conflict", conflicts };
  const job = await db.job.update({ where: { id: jobId, organizationId }, data: { scheduledDate: newStart, scheduledEndAt: newEnd } });
  await logActivity({ entityType: "JOB", entityId: jobId, type: "job_rescheduled", createdById: (await requireSession()).userId });
  return { success: true, data: job };
}
```
`checkConflicts()` is a plain overlap query (`assignedToId = ? AND scheduledDate < newEnd AND (scheduledEndAt > newStart OR scheduledEndAt IS NULL)`) against the existing `assignedToId` index — no new index required.

### 13.7 Data Flow
`Staff drags a JobEventCard → client computes proposed new start/end → rescheduleJob() → conflict check → conditional update (reuses the existing Job status-transition conditional-update discipline, extended to the date fields) → revalidatePath('/schedule') and revalidatePath('/jobs/calendar')` — both calendar surfaces stay consistent because they read the same `Job` rows.

### 13.8 Permission Model
Identical to the existing Job module (Section 20/23 of the Phase 5 document): `OWNER`/`STAFF` see and reschedule every technician's Jobs; `FIELD` sees only their own assigned Jobs and cannot drag-reschedule (read-only agenda view for `FIELD`, consistent with "a FIELD user can never reassign their own Job").

### 13.9 Security Considerations
No new authorization surface — `getScheduleForRange()`/`rescheduleJob()` both pass through the same `requireCompanyScope()`/`requireRole()` helpers every other Job action already uses; there is no new query that fetches a `Job` by ID without an `organizationId` filter.

### 13.10 Error Handling & Validation
A conflict returns a typed `{ success: false, conflicts: Job[] }` so the UI can show *which* other Job collides, not just that one does. A stale drag (the Job was reassigned by someone else mid-drag) hits the same `P2025`-style conditional-update failure pattern Section 22 of the Phase 5 document already established, mapped to "This job was changed by someone else — refresh and try again."

### 13.11 Performance & Caching Strategy
No caching — a calendar view is read live, same posture as every other Phase 5 transactional screen (Section 23 carries this forward). The range query is bounded (one week at most rendered at once) and filtered through the existing `(organizationId, status)`/`assignedToId` indexes, so no new index is needed even at this added query shape.

### 13.12 Testing Strategy
Unit tests for `checkConflicts()` (overlapping range, adjacent-but-not-overlapping range, no `scheduledEndAt` set); an integration test confirming `FIELD` cannot call `rescheduleJob()` even via a direct request; a component test for drag-and-drop updating the optimistic UI and rolling back on a conflict response.

### 13.13 Future Extension Points
Two-way sync with a real calendar provider (Google Calendar/Outlook) is a named, unbuilt `IntegrationProvider` adapter (Section 20) — the `Job.scheduledDate`/`scheduledEndAt` pair is already shaped like a calendar event, so the adapter's job is purely translation, not a redesign of this section. Recurring/templated Jobs (already a named Phase 5 future extension point) would slot into this same calendar view unmodified once built.

---

## 14. File & Media Management Architecture

### 14.1 Executive Overview
Generalizes the single-field, URL-paste pattern Phase 4 already proved out for `Organization.logoUrl` into a reusable, polymorphic attachment system for job photos, before/after images, quote/invoice attachments, and general company documents — without requiring real file storage to exist yet.

### 14.2 Responsibilities
Attach, list, and remove files against any entity (or organization-level, for general documents); abstract *where* the file's bytes actually live behind a `StorageProvider` interface so the zero-cost mode (paste a URL) and the funded mode (real upload to Vercel Blob) are interchangeable with zero change to any consuming feature.

### 14.3 Data Model
`FileAttachment` (Section 7.2.2).

### 14.4 Folder Structure
`features/files/` — extended, not replaced: the existing `components/FileUrlInput` and `types.ts` (`FileRef`) stay exactly as Phase 4 built them for `Organization.logoUrl`; Phase 6 adds `providers/`, a new `FileAttachmentList` component, and new `actions.ts`/`queries.ts`. See Section 8.

### 14.5 Components
`FileUrlInput` (unchanged, Phase 4) — reused as the upload widget under `UrlPasteProvider`; a real `<UploadDropzone>` component is written for `VercelBlobProvider` but not wired into any screen until that provider is active (Section 14.13). `FileAttachmentList` renders thumbnails/icons per `category`, grouped, with a remove action gated by the same role that can edit the parent entity.

### 14.6 Server Actions & Services
```ts
interface StorageProvider {
  // For UrlPasteProvider, "upload" just validates and echoes back the pasted URL.
  // For VercelBlobProvider, this performs a real upload and returns the resulting blob URL.
  store(input: { url?: string; file?: File }): Promise<{ url: string; sizeBytes?: number }>;
}

export async function attachFile(input: {
  entityType?: EntityType; entityId?: string; category: string; fileName: string; url: string;
}) {
  const session = await requireSession();
  const { organizationId } = await requireCompanyScope();
  const provider = resolveStorageProvider();                  // Section 14.13
  const { url, sizeBytes } = await provider.store({ url: input.url });
  const attachment = await db.fileAttachment.create({ data: { organizationId, ...input, url, sizeBytes, uploadedById: session.userId } });
  if (input.entityType && input.entityId) {
    await logActivity({ entityType: input.entityType, entityId: input.entityId, type: "file_attached", createdById: session.userId });
  }
  return attachment;
}
```

### 14.7 Data Flow
`Staff/FIELD pastes a URL (or, once funded, uploads a file) → StorageProvider.store() → FileAttachment row written → Activity entry (if entity-scoped) → FileAttachmentList revalidates on the parent entity's detail page`.

### 14.8 Permission Model
Follows the parent entity's existing edit permission: a `FIELD` user can attach Job photos to their own assigned Jobs (this is explicitly named in the brief — "before/after images" is a field-technician workflow); `OWNER`/`STAFF` can attach to any entity they can already edit; organization-level ("Company documents," `entityType = null`) attachments are `OWNER`-only, mirroring Settings-level write restrictions elsewhere.

### 14.9 Security Considerations
Under `UrlPasteProvider`, the system never fetches or proxies the pasted URL server-side (no SSRF surface) — it is stored and rendered as a plain `<img src>`/link exactly as `Organization.logoUrl` already is. Under the future `VercelBlobProvider`, uploads are scoped to a per-organization path prefix and validated for MIME type/size before storage, consistent with standard upload-hardening practice — designed now, enforced when that provider is actually wired (Section 14.13).

### 14.10 Error Handling & Validation
Pasted URLs are validated as well-formed `https://` URLs via the same Zod-at-the-boundary discipline every other form input already follows (Phase 3 §9.3-style refinement, generalized). A failed attach returns the standard `ActionResult<T>` shape — no partial `FileAttachment` row is ever left referencing a `store()` call that failed.

### 14.11 Performance & Caching Strategy
No caching — attachment lists are small (a handful of files per entity) and read on the same cadence as the entity's other detail-page data; no separate fetch round-trip beyond what `<EntityDetailTabs>` already does for Activity/Notes/Tasks (Section 17 carries this shell forward unmodified).

### 14.12 Testing Strategy
Unit tests for URL validation; an integration test confirming a `FIELD` user can attach to their own Job but not to another technician's Job; a provider-swap test (same pattern as Section 11.12) confirming `UrlPasteProvider` and a mock `VercelBlobProvider` produce identical `FileAttachment` row shapes.

### 14.13 Future Extension Points — funding trigger
**Adopt Vercel Blob when:** real clients want to upload their own photos/logos instead of pasting a URL — the exact trigger the Zero-Cost Build Plan already names. At that point: install `@vercel/blob`, implement `VercelBlobProvider.store()`, wire `<UploadDropzone>` into `FileAttachmentList` in place of `FileUrlInput`, set `STORAGE_PROVIDER=vercel-blob` — zero change to `attachFile()`, the `FileAttachment` schema, or any entity's detail page.

---

## 15. Automation Engine

### 15.1 Executive Overview
A configurable, Owner-editable trigger/action framework that *generalizes* business logic Phase 5 already hardcoded (e.g., "accepting a Quote creates a Job" lives directly inside `acceptQuote()`) into rules an Owner can define for *new* combinations, without QuoteFlow ever needing a redesign of the underlying state machine each time a client wants one more "if this, then that."

### 15.2 Responsibilities
Define two trigger categories — **event-driven** (fires synchronously inside an existing action, e.g. `quote.accepted`) and **time-based** (fires lazily on read, e.g. `invoice.overdue`, until a cron runner is funded); evaluate `AutomationRule.conditions` against the triggering entity; execute `AutomationRule.actions` in order; log every execution.

### 15.3 Data Model
`AutomationRule`, `AutomationLog` (Section 7.2.5).

### 15.4 Folder Structure
`features/automation/{components/, engine.ts, actions.ts, queries.ts}`. See Section 8.

### 15.5 Components
`RuleBuilder` (trigger picker → condition rows → action rows, a form over the `conditions`/`actions` JSON shapes — not a visual flowchart builder in V1, which is named explicitly as a future richer UI, Section 27), `RuleList`, `AutomationLogTable` (read-only history, filterable by rule).

### 15.6 Server Actions & Services
```ts
// features/automation/engine.ts — called from inside existing Phase 5 actions, additively
export async function fireTrigger(triggerType: string, entityType: EntityType, entity: Record<string, unknown>, organizationId: string) {
  const rules = await db.automationRule.findMany({ where: { organizationId, triggerType, isActive: true } });
  for (const rule of rules) {
    const matched = evaluateConditions(rule.conditions, entity);
    if (!matched) { await logRun(rule.id, "SKIPPED"); continue; }
    try {
      for (const action of rule.actions as AutomationAction[]) await runAction(action, entity, organizationId);
      await logRun(rule.id, "SUCCESS");
    } catch (err) { await logRun(rule.id, "FAILED", String(err)); }
  }
}
```
`fireTrigger()` is called from one new line added at the *end* of existing Phase 5 actions (e.g., `acceptQuote()` calls `fireTrigger("quote.accepted", "QUOTE", quote, organizationId)` after its own hardcoded Job-creation logic completes) — this is additive instrumentation, not a replacement of the hardcoded logic itself, which stays exactly as Phase 5 built it. `runAction()` dispatches to a small fixed set of action types in V1: `send_notification`, `send_email` (via Section 11's `sendTemplatedEmail()`), `create_task`, `log_activity`. Each is a thin wrapper over an existing Phase 4/5/6 service — the engine never duplicates business logic, it only sequences calls to logic that already exists.

### 15.7 Data Flow
`Business event occurs (status transition, invoice viewed on a list page, etc.) → fireTrigger(triggerType, ...) → load matching active rules → evaluate conditions → run actions in order → AutomationLog row per rule per firing`. For time-based triggers (`invoice.overdue`, `lead.inactive`), the firing point is not a cron tick but the next time the relevant list/detail query runs (e.g., the existing on-read overdue-detection query in the Invoices module, Section 21 of the Phase 5 document) — `fireTrigger("invoice.overdue", ...)` is called from inside that existing read path, gated so a given Invoice/rule pair fires at most once per day (a `lastFiredAt` check inside `AutomationLog`, avoiding a notification storm every time the list page is viewed).

### 15.8 Permission Model
Rule management (`createRule`/`updateRule`/`deactivateRule`) is `OWNER`-only — automation rules can change business behavior org-wide, the same justification Phase 5 already used to restrict Catalog writes to `OWNER`. Rule *execution* carries no user-facing permission check of its own — it runs with the same authority the triggering action already had, since it only calls already-permission-appropriate service functions (e.g., `send_email` can't be configured to email an address outside the system's own templates).

### 15.9 Security Considerations
`conditions`/`actions` are structured JSON validated against a closed Zod schema (a fixed set of operators, a fixed set of action types) — never arbitrary code, never a template string `eval`'d — so an Owner cannot (accidentally or otherwise) configure a rule that does anything the engine's own `runAction()` switch statement doesn't explicitly support. This closes the "configurable automation = code injection surface" risk at the schema level, not just by convention.

### 15.10 Error Handling & Validation
A failed action (e.g., `send_email` throws) is caught per-action, logged to `AutomationLog` as `FAILED` with the error message, and does **not** roll back or block the other actions in the same rule, nor the triggering business action itself — automation failures are observability concerns, never a reason a Quote-accept or Invoice-create should fail.

### 15.11 Performance & Caching Strategy
`AutomationRule` lookups are filtered by the same `(organizationId, triggerType, isActive)` index defined in Section 7.2.5 — a small, cached-friendly read (rules change rarely; the same `lib/config`-style cache-tag pattern, `automation-rules-${organizationId}`, applies and is invalidated on any rule write). Time-based triggers' "fire at most once per day" check is a single indexed `AutomationLog` lookup, not a separate scheduled scan.

### 15.12 Testing Strategy
Unit tests for `evaluateConditions()` against every supported operator; an integration test confirming `fireTrigger()` called twice for the same event/rule with `SKIPPED` conditions logs twice but performs zero actions; an integration test confirming a `FAILED` action doesn't roll back the triggering business transaction.

### 15.13 Future Extension Points — funding trigger
**Adopt a real cron runner (Vercel Cron, low/no additional cost on current hosting, or a dedicated scheduler) when:** an Owner needs a time-based automation (overdue reminder, lead-inactivity nudge) to fire *proactively* rather than the next time someone happens to view the relevant list — the same trigger condition Phase 5's own Section 42 already named ("Scheduled-job-driven reminders... once a cron runner and Resend are both funded"). At that point, a single new scheduled route (`/api/cron/automation-sweep/route.ts`) calls `fireTrigger()` for every time-based `triggerType` across every organization — zero change to `engine.ts`, `AutomationRule`, or any existing action's call site. A richer visual rule-builder UI (drag-and-drop trigger/condition/action blocks) is a named future UI investment, independent of this section's data model.
## 16. AI Layer

### 16.1 Executive Overview
A provider-agnostic AI assistance layer — quote drafting help, email drafting, job summaries, lead prioritization, revenue insights, search assistance — that ships fully wired but **off by default**, costing nothing until an Owner explicitly enables it and a real provider is funded.

**AI is strictly optional, system-wide.** No feature in this document, in Phase 6 or in any frozen phase, depends on an AI provider being configured. Every workflow AI can assist with also has a complete, fully functional, AI-free path that requires no code change to use — drafting a quote's notes by hand, writing an email manually, prioritizing leads by eye — exactly as every one of those workflows already works today, in Phase 5, with zero AI involvement. Enabling AI later adds a convenience; it removes nothing and unlocks nothing that was previously blocked.

### 16.2 Responsibilities
Define the single `AIProvider` interface every AI-assisted feature calls; implement the feature-flag gate (`Organization.settings.featureFlags.aiEnabled`) that short-circuits to `NullAIProvider` when off; implement usage logging so cost is observable from the first real call onward, not retrofitted later.

### 16.3 Data Model
`AiUsageLog` (Section 7.2.8).

### 16.4 Folder Structure
`features/ai/{providers/, components/, actions.ts}`. See Section 8.

### 16.5 Components
`AiSuggestButton` (a small, dismissible affordance next to relevant fields — e.g., on the Quote Builder's notes field, on a Job's completion-notes field), `AiDraftPanel` (shows the suggestion, with explicit Accept/Discard — never auto-applied). Both components render nothing and make no network call when `aiEnabled` is false; they are present in the codebase from this phase but invisible in the product until the flag flips.

### 16.6 Server Actions & Services
```ts
interface AIProvider {
  complete(input: { prompt: string; feature: string }): Promise<{ text: string; tokensUsed: number; costEstimate: number }>;
}

class NullAIProvider implements AIProvider {
  async complete({ feature }) { return { text: "", tokensUsed: 0, costEstimate: 0 }; }   // never called for a real suggestion — UI hides the button instead, Section 16.10
}

export async function generateQuoteDraft(leadId: string) {
  const { organizationId } = await requireCompanyScope();
  if (!(await isFeatureEnabled(organizationId, "aiEnabled"))) return { success: false, error: "AI features are not enabled" };
  const provider = resolveAiProvider();
  const lead = await getLeadScoped(leadId, organizationId);
  const result = await provider.complete({ prompt: buildQuotePrompt(lead), feature: "quote_draft" });
  await db.aiUsageLog.create({ data: { organizationId, feature: "quote_draft", provider: provider.name, tokensUsed: result.tokensUsed, costEstimate: result.costEstimate, createdById: (await requireSession()).userId } });
  return { success: true, data: result.text };
}
```
Every AI-assisted action is read-only with respect to QuoteFlow's own data model — it produces a *suggestion string* a staff member explicitly accepts into an existing field via the existing save action (e.g., the Quote Builder's own `notes` input); the AI layer never writes a `Quote`/`Lead`/`Job` field directly. This keeps "server-authoritative everything" (Section 6) intact even for AI output: AI proposes, the existing, already-validated business action disposes.

### 16.7 Data Flow
`Staff clicks AiSuggestButton → generateQuoteDraft()/draftEmail()/summarizeJob() → feature-flag check → AIProvider.complete() → AiUsageLog write → suggestion returned to AiDraftPanel → staff edits/accepts → existing save action persists, unchanged`.

### 16.8 Permission Model
Any role that can already edit the underlying entity can request an AI suggestion for it (e.g., `OWNER`/`STAFF` for Quote drafting; `FIELD` for Job-summary assistance on their own assigned Job) — no new permission tier, the AI layer rides the existing entity-level permission exactly.

### 16.9 Security Considerations
Prompts are built server-side from already-organization-scoped data (`buildQuotePrompt()` receives a pre-scoped `lead`, never a raw client-supplied entity ID resolved inside the prompt-builder itself) — closing the prompt-injection-via-cross-tenant-data class of risk by construction, the same discipline as every other Phase 5/6 query. No customer-portal or public-API caller can reach an AI action — it is staff-only surface area in V1.

### 16.10 Error Handling & Validation
When `aiEnabled` is false, `AiSuggestButton` is not rendered at all (checked once at page-load via the already-cached Company Configuration Service, Section 5 of the Phase 4 document) — not rendered-then-disabled, so there is no UI affordance that calls `NullAIProvider` in production; `NullAIProvider` exists purely so `resolveAiProvider()` always returns a valid object during local development/tests without a key configured, never as a path a real user clicks through. A provider error (rate limit, API failure) is caught, logged, and surfaced as "AI suggestion unavailable right now" — never blocking the underlying save action.

### 16.11 Performance & Caching Strategy
No caching of AI output (each suggestion is request-specific and cheap to regenerate; caching a stale suggestion risks staff accepting outdated advice). The feature-flag check itself is cached via the existing Company Configuration Service cache (`org-config-${organizationId}`), so checking "is AI on" never costs an extra query beyond what Phase 4 already pays.

### 16.12 Testing Strategy
Unit tests confirming `NullAIProvider` is returned and no network call is attempted when `aiEnabled` is false; an integration test confirming `AiUsageLog` is written on every real-provider call (mocked) with correct `tokensUsed`/`costEstimate`; a security test confirming `buildQuotePrompt()` cannot be made to include another organization's data via crafted input.

### 16.13 Future Extension Points — funding trigger
**Adopt a real provider when:** an Owner explicitly opts in and is willing to pay per-token cost — entirely usage-driven, unlike Resend/Vercel Blob's "first real client" trigger, since AI cost scales with usage from the first call. At that point: implement `AnthropicProvider`/`OpenAiProvider` against the same interface via a plain `fetch()` call to the provider's REST API (no SDK dependency required, keeping the zero-new-package discipline Phase 5 already demonstrated for Zustand/Recharts), set `AI_PROVIDER` + the relevant API key, flip `aiEnabled` per organization — zero change to `generateQuoteDraft()`, `AiSuggestButton`, or `AiUsageLog`. Lead-scoring/revenue-insight features (named in the brief) are additional `feature` values on the same interface, not a new subsystem.

---

## 17. Dashboard Expansion

### 17.1 Executive Overview
Extends the Phase 5 dashboard (5 KPIs, read-only pipeline, lead-source bars, recent-activity feed) with revenue forecasting, technician performance, sales performance, and deeper pipeline analytics — as new widgets reading the same frozen tables, never a redesign of the existing five.

### 17.2 Responsibilities
Add new aggregate-query-backed widgets; keep every existing Phase 5 widget exactly as built; ensure new widgets respect the same role-based visibility precedent already set for the revenue report (Section 34 of the Phase 5 document).

### 17.3 Data Model
None (Section 7.3) — pure read-aggregation over `Lead`, `Quote`, `Job`, `Invoice`, `Payment`, exactly the frozen database document's own Section 6 philosophy, now extended to more aggregate shapes.

### 17.4 Folder Structure
`features/dashboard/` — extended, not replaced. New widget components added alongside the existing ones; `queries.ts` gains new exported functions, none of the existing ones are changed.

### 17.5 Components
`RevenueForecastWidget` (linear projection over the last N months' `Payment.amount`, not a statistical model — explicitly simple, matching the "no pre-computed summary tables, no premature sophistication" posture), `TechnicianPerformanceWidget` (Jobs completed, average completion time, per `FIELD` user), `SalesPerformanceWidget` (Quotes sent/accepted, conversion rate, per `assignedToId`), `PipelineAnalyticsWidget` (deeper breakdown of the existing read-only Lead kanban — stage-duration averages, not a new interaction model).

### 17.6 Server Actions & Services
```ts
export async function getTechnicianPerformance(organizationId: string, range: DateRange) {
  return db.job.groupBy({
    by: ["assignedToId"],
    where: { organizationId, status: "COMPLETED", completedAt: { gte: range.start, lte: range.end } },
    _count: { id: true },
    _avg: { /* completion duration computed in application code from scheduledDate→completedAt, Decimal-safe */ },
  });
}
```
Every new widget query follows the exact `groupBy`/aggregate, single-statement, no-N+1 pattern Section 37 of the Phase 5 document already mandates — restated, not reinvented, for the new shapes.

### 17.7 Data Flow
`Dashboard page load → requireCompanyScope() → parallel widget queries (existing five + new four) → server-rendered → no client refetch unless the staff member changes the date range filter`.

### 17.8 Permission Model
`OWNER`: every widget. `STAFF`: every widget except `RevenueForecastWidget` (financial, gated the same way the Revenue/AR report already is). `FIELD`: no dashboard access at all, unchanged from Phase 5 (`FIELD` is redirected to `/jobs`).

### 17.9 Security Considerations
No new authorization surface — every new widget's query passes through `requireCompanyScope()` exactly like the existing five; the one financial widget reuses the existing `requireRole(["OWNER"])` gate pattern from the revenue report, not a new one.

### 17.10 Error Handling & Validation
Each widget renders its own loading/empty/error state independently (a failed `TechnicianPerformanceWidget` query doesn't blank the whole dashboard) — extending the Phase 4 page-primitive convention of independent error boundaries per `<PageSection>`.

### 17.11 Performance & Caching Strategy
No caching, consistent with Phase 5's explicit rule that transactional/aggregate business data is read live at this scale (Section 38 of the Phase 5 document) — revisited only if a real client's data volume makes the live queries measurably slow, per that same section's own stated escape hatch.

### 17.12 Testing Strategy
Unit tests for each new aggregate query's edge cases (zero completed Jobs, single technician, date range with no data); a role-gate test confirming `STAFF` cannot reach `RevenueForecastWidget`'s data via direct query call.

### 17.13 Future Extension Points
Pre-computed summary tables if live aggregation ever becomes too slow (Phase 5's own named future option, inherited unchanged); drag-and-drop Kanban on the pipeline widget (also inherited, unchanged); a statistical (not linear) forecasting model, gated behind the same `AIProvider` interface (Section 16) if an Owner wants AI-assisted forecasting rather than a simple trend line.

---

## 18. Reporting Expansion

### 18.1 Executive Overview
Extends the Phase 5 first-tier reports (turnaround, loss pattern, lead-source ROI, revenue/AR) with profitability, technician utilization, quote-acceptance trends, customer lifetime value, revenue forecasting, aging, and tax-summary reports — every one a single aggregate query, none a new table.

### 18.2 Responsibilities
Add new report tabs to the existing Reports screen; preserve the existing `OWNER`-only gate on every genuinely financial report, exactly as Phase 5 established for Revenue/AR.

### 18.3 Data Model
None.

### 18.4 Folder Structure
`features/reports/` — extended, not replaced.

### 18.5 Components
New tabs inside the existing Reports page shell: `ProfitabilityReport`, `TechnicianUtilizationReport`, `QuoteAcceptanceTrendReport`, `CustomerLifetimeValueReport` (extends, not duplicates, the lifetime-value computation already built for the Customer detail page in Phase 5), `AgingReport` (AR aging buckets: 0–30/31–60/61–90/90+ days past `Invoice.dueDate`), `TaxSummaryReport` (`SUM(QuoteItem`'s proportional tax) `GROUP BY TaxRate` over a date range, for an Owner's own tax filing reference — explicitly not a tax-filing or compliance tool, just a read of data already captured).

### 18.6 Server Actions & Services
```ts
export async function getAgingReport(organizationId: string) {
  const unpaid = await db.invoice.findMany({ where: { organizationId, status: { not: "PAID" } }, select: { amount: true, paidAmount: true, dueDate: true } });
  return bucketByAge(unpaid, new Date());  // pure function, unit-tested independent of the query
}
```
`ProfitabilityReport` is the one report needing a small, explicit business-rule decision: "cost" has no dedicated column anywhere in the frozen schema (no `Job.laborCost`, no `Service.cost`). **Decision:** V1 profitability is `Invoice.amount` (revenue) against `LeadSource.costPerLead` (the only real cost figure the schema captures) — a lead-acquisition-cost profitability view, not a full job-costing P&L. A true job-costing profitability report is named explicitly as a future extension (Section 18.13) gated on a schema addition this document does not make, consistent with "no speculative schema change."

### 18.7 Data Flow
Identical shape to every Phase 5 report: `Reports page → tab selected → requireRole-gated query → single aggregate statement → rendered table/chart`.

### 18.8 Permission Model
| Report | Visibility |
|---|---|
| Quote acceptance trend | OWNER, STAFF |
| Technician utilization | OWNER, STAFF |
| Customer lifetime value | OWNER, STAFF |
| Aging report | **OWNER only** (financial) |
| Profitability | **OWNER only** (financial) |
| Tax summary | **OWNER only** (financial) |

Extends the existing table in Section 34 of the Phase 5 document with the same gating logic already applied to Revenue/AR — no new gating mechanism.

### 18.9 Security Considerations
Same as Section 17.9 — every new report query is `requireCompanyScope()`-filtered; the financial subset reuses the existing `OWNER`-only role check verbatim.

### 18.10 Error Handling & Validation
Empty-result states (zero invoices, zero leads in range) render an explicit "No data for this period" rather than a blank chart, consistent with the existing Dashboard's edge-case handling.

### 18.11 Performance & Caching Strategy
No caching, same rationale as Section 17.11. Date-range filters reuse the existing indexed `createdAt`/`dueDate`/`completedAt` columns — no new index required for any report in this section.

### 18.12 Testing Strategy
Unit tests for `bucketByAge()`'s boundary conditions (exactly 30/60/90 days); a role-gate test per financial report confirming `STAFF` is denied; a snapshot test confirming the CSV exporter (Section 32 of the Phase 5 document, extended) produces correct rows for each new report.

### 18.13 Future Extension Points
A true job-costing `ProfitabilityReport` once/if a real client need justifies adding `Job.laborCost`/`Service.cost`-style fields — explicitly deferred, not built speculatively (mirrors the frozen database document's own discipline around `PriceList`). Pre-computed report summary tables, inherited unchanged from Phase 5's Section 42.

---

## 19. Notification Expansion

### 19.1 Executive Overview
Extends the Phase 4 in-app `Notification` model (unchanged schema) with a second delivery channel (email, via Section 11's `EmailProvider`) and per-user channel preferences — without altering a single existing Notification call site's behavior when the new channel is unavailable or disabled.

### 19.2 Responsibilities
Wire new `type` values from every Phase 6 subsystem (`automation_executed`, `portal_contact_updated`, `webhook_delivery_failed`, `api_key_created`, `integration_connected`, `file_attached`) into the existing producer/consumer contract; add an optional email-channel fan-out; add per-user preference storage and enforcement.

### 19.3 Data Model
`User.notificationPreferences` (Section 7.2, additive nullable column). No change to the frozen `Notification` table itself.

### 19.4 Folder Structure
`features/notifications/` — extended, not replaced (Phase 4's `actions.ts`/`queries.ts`/components stay exactly as built; this section adds a new `dispatch.ts` for the email fan-out and a new `preferences.ts`).

### 19.5 Components
`NotificationPreferencesForm` (new — Settings → Account, per-channel/per-type toggles), `NotificationBell`/`NotificationCenter` (unchanged, Phase 4).

### 19.6 Server Actions & Services
```ts
// features/notifications/dispatch.ts — wraps, does not replace, Phase 4's createNotification()
export async function createNotification(input: NotificationInput) {
  const notification = await db.notification.create({ data: input });          // unchanged Phase 4 call
  const prefs = await getEffectivePreferences(input.userId);
  if (prefs.email && !prefs.mutedTypes.includes(input.type) && (await isFeatureEnabled(input.organizationId, "emailProviderEnabled"))) {
    await sendTemplatedEmail({ organizationId: input.organizationId, templateType: `notification_${input.type}`, to: await getUserEmail(input.userId) });
  }
  return notification;
}
```
`getEffectivePreferences()` returns `{ inApp: true, email: true, mutedTypes: [] }` when `User.notificationPreferences` is `null` — the documented default that requires no backfill (Section 7.2).

### 19.7 Data Flow
`Any Phase 4–6 event → createNotification() → in-app Notification row written (always) → preference check → optional email fan-out via Section 11's pipeline (its own EmailLog, independent of the Notification row's own lifecycle)`. The in-app notification is never blocked or delayed by the email path — they are decoupled, sequential best-effort, not transactional together.

### 19.8 Permission Model
A user can only read/manage their own `notificationPreferences` (`requireSession()` scopes the update to `session.userId`, no admin override needed in V1 — an Owner cannot mute a Staff member's notifications on their behalf, by design, consistent with notification preference being personal state, not organizational config).

### 19.9 Security Considerations
No new authorization surface beyond the existing `Notification` read scoping (`userId = session.userId`, unchanged from Phase 4); the email fan-out reuses Section 11's existing security posture (server-derived `from`, template-rendered body) verbatim.

### 19.10 Error Handling & Validation
An email-fan-out failure is logged (in `EmailLog`, per Section 11.10) and never throws back into `createNotification()`'s caller — the in-app notification, which is the channel every existing Phase 4/5 call site already depends on, is unaffected by an email provider outage.

### 19.11 Performance & Caching Strategy
`notificationPreferences` is read once per `createNotification()` call — acceptable at this volume (one row lookup per notification, same cost class as every other Phase 4/5 per-row check); a future optimization (caching preferences per session) is not needed at Standard-tier volume.

### 19.12 Testing Strategy
Unit tests for `getEffectivePreferences()`'s null-default behavior; an integration test confirming a muted `type` suppresses the email fan-out but not the in-app row; a test confirming `emailProviderEnabled = false` suppresses email fan-out regardless of preference (the global flag always wins over a per-user opt-in, since there's no provider to deliver through anyway).

### 19.13 Future Extension Points
SMS as a third channel, behind the same `EmailProvider`-style pattern generalized into a `NotificationChannel` interface, once an SMS provider (Twilio or similar) is funded — named in the Integration Framework (Section 20) as an unbuilt adapter. Digest/batched notifications (daily summary email instead of one-per-event) once volume makes per-event email noisy.

---

## 20. Integration Framework

### 20.1 Executive Overview
A generalized version of the Provider Adapter Pattern (Section 6) — already applied one-off to Email, Storage, and AI in Sections 11/14/16 — formalized into a single registry so a *future* integration (QuickBooks, Google Calendar, Stripe, a generic webhook-based CRM) is added the same mechanical way, every time, without inventing a new pattern per integration.

### 20.2 Responsibilities
Define the `IntegrationProvider` interface and the registry that looks one up by `provider` string; define the `Integration` connection-record lifecycle (not-connected → connected → error); define how integration-specific credentials are handled without ever putting a secret in the `Integration.config` JSON column.

### 20.3 Data Model
`Integration` (Section 7.2.6).

### 20.4 Folder Structure
`features/integrations/{components/, registry.ts, actions.ts, queries.ts}`. See Section 8.

### 20.5 Components
`IntegrationCard` (one per registered provider — "Connect"/"Disconnect"/status), `IntegrationSettingsPage` (Settings → Integrations, listing every registered `IntegrationProvider` whether or not it's connected yet — so the Owner can see what's *possible*, not just what's active, which is itself a useful sales/demo surface for the portfolio narrative).

### 20.6 Server Actions & Services
```ts
interface IntegrationProvider {
  key: string;                  // "quickbooks" | "google_calendar" | "stripe" | ...
  displayName: string;
  connect(organizationId: string, authPayload: unknown): Promise<{ status: "CONNECTED" | "ERROR"; config?: Json }>;
  disconnect(organizationId: string): Promise<void>;
}

export const integrationRegistry: IntegrationProvider[] = [
  // empty in Phase 6 — zero live integrations built, per Section 5's Non-Goals.
  // Adding a real one is: write one file implementing this interface, push it
  // into this array. No change to the registry, the action, or the UI.
];

export async function connectIntegration(providerKey: string, authPayload: unknown) {
  await requireRole(["OWNER"]);
  const { organizationId } = await requireCompanyScope();
  const provider = integrationRegistry.find(p => p.key === providerKey);
  if (!provider) return { success: false, error: "Unknown integration" };
  const result = await provider.connect(organizationId, authPayload);
  return db.integration.upsert({ where: { organizationId_provider: { organizationId, provider: providerKey } }, create: { organizationId, provider: providerKey, status: result.status, config: result.config, connectedAt: new Date() }, update: { status: result.status, config: result.config, connectedAt: new Date() } });
}
```

### 20.7 Data Flow
`Owner clicks Connect on an IntegrationCard → OAuth/credential flow specific to that provider (handled entirely inside that provider's own connect() implementation, never by the registry) → connectIntegration() → Integration row upserted → IntegrationCard reflects CONNECTED`.

### 20.8 Permission Model
`OWNER`-only for connect/disconnect — identical justification to Catalog and Automation Rules: integration state is organization-wide configuration with broad blast radius if misconfigured.

### 20.9 Security Considerations
**Credential handling rule (binding for every future adapter, not just designed-for):** `Integration.config` never contains a raw secret, API key, or OAuth token. A real adapter that needs to persist a credential stores it via a server-only secret store (an encrypted column or, more simply at this tier, an environment-variable-scoped per-organization secret reference) — never the `config Json` field, which is treated as readable-by-any-`OWNER`-screen non-secret metadata only (e.g., "which QuickBooks company file is linked," not the OAuth token itself). This rule is stated now, in the framework, precisely so no future integration adapter quietly violates it under deadline pressure.

### 20.10 Error Handling & Validation
A `connect()` failure returns `{ status: "ERROR" }`, persisted as-is on the `Integration` row so the `IntegrationCard` can show "Connection failed — try again" rather than silently appearing connected. The registry itself never throws for an unknown `providerKey` — it returns a typed `ActionResult` failure, since a stale UI referencing a since-removed integration should fail gracefully, not 500.

### 20.11 Performance & Caching Strategy
`Integration` rows are read once per Settings page load — no caching needed, low-frequency, `OWNER`-only screen.

### 20.12 Testing Strategy
A registry unit test confirming an unknown `providerKey` returns a clean failure, not a throw; an integration test confirming `STAFF` cannot call `connectIntegration()`; once any real adapter exists, a contract test asserting it never writes a secret-shaped value into `config`.

### 20.13 Future Extension Points
Every concrete integration named in the brief (accounting software, payment providers, calendar providers, SMS providers, cloud storage beyond Vercel Blob, CRM integrations) is a future `IntegrationProvider` implementation file plus one registry-array entry — zero change to this section's data model, registry mechanism, or permission model, by design. Webhook *ingestion* from a third party (e.g., a Stripe webhook notifying QuoteFlow of a payment) would reuse this same `Integration` record to look up which organization a given inbound webhook belongs to, and is named here as the natural extension point rather than a separate, parallel design.

---

## 21. Public API Architecture

### 21.1 Executive Overview
A versioned, key-authenticated REST API (`/api/v1/*`) exposing Leads, Quotes, Jobs, Invoices, and Customers to third-party callers (e.g., Zapier, a client's own internal scripts), with outbound webhooks for the same event taxonomy Activity already tracks — a third, fully isolated authentication plane alongside the staff session (Phase 3) and the Customer Portal session (Section 12).

### 21.2 Responsibilities
Authenticate every request via a hashed `ApiKey`; enforce per-key scopes; rate-limit per key; version the API path so a future v2 never breaks a v1 integration; standardize error/pagination/filtering shapes; dispatch outbound webhooks reliably with retry.

### 21.3 Data Model
`ApiKey`, `Webhook`, `WebhookDelivery` (Sections 7.2.3–7.2.4).

### 21.4 Folder Structure
`app/api/v1/*` (route handlers), `features/api-keys/`, `features/webhooks/`, `lib/rate-limit/`. See Section 8.

### 21.5 Components
`ApiKeyList`/`CreateApiKeyDialog` (Settings → API Keys — the new key is shown once, in full, at creation, with the same "copy this now" UX pattern Phase 3 already established for teammate temporary passwords), `WebhookList`/`CreateWebhookDialog` (Settings → Integrations, alongside `IntegrationCard`s).

### 21.6 Server Actions & Services
Per the convention in Section 6.1, rate limiting is abstracted behind a `RateLimiter` interface rather than `requireApiKey()` calling a specific limiter implementation directly:
```ts
// lib/rate-limit — the interface every limiter implements
interface RateLimiter {
  checkLimit(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }>;
}

function resolveRateLimiter(): RateLimiter { return new DbRateLimiter(); }   // only branch point if Upstash is ever adopted — Section 21.13

// lib/api/auth.ts — the API's analog to requireSession()
export async function requireApiKey(req: Request, requiredScope: string) {
  const raw = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!raw) throw new ApiError(401, "missing_api_key");
  const candidates = await db.apiKey.findMany({ where: { isActive: true, revokedAt: null, keyPrefix: raw.slice(0, 11) } }); // prefix narrows the bcrypt-compare set
  const match = await firstBcryptMatch(candidates, raw);
  if (!match) throw new ApiError(401, "invalid_api_key");
  if (!match.scopes.includes(requiredScope)) throw new ApiError(403, "insufficient_scope");
  const limit = await resolveRateLimiter().checkLimit(match.id);    // Section 21.11
  if (!limit.allowed) throw new ApiError(429, "rate_limited");
  await db.apiKey.update({ where: { id: match.id }, data: { lastUsedAt: new Date() } });
  return { organizationId: match.organizationId, scopes: match.scopes };
}

// app/api/v1/quotes/route.ts
export async function GET(req: Request) {
  const { organizationId } = await requireApiKey(req, "quotes:read");
  const { page, pageSize, status } = parseListParams(req);
  const [items, total] = await Promise.all([
    db.quote.findMany({ where: { organizationId, ...(status && { status }) }, skip: (page-1)*pageSize, take: pageSize }),
    db.quote.count({ where: { organizationId } }),
  ]);
  return Response.json({ data: items, pagination: { page, pageSize, total } });
}
```
Every `/api/v1/*` handler follows this identical shape: `requireApiKey(req, scope)` → org-scoped query (the exact same Prisma `where: { organizationId }` discipline every internal action already follows) → standardized envelope. Write endpoints additionally call the *same* `features/<entity>/actions.ts` functions the internal app uses (e.g., `POST /api/v1/quotes` calls the same `createQuote()` Section 16 of the Phase 5 document already defines, just with the caller identity coming from `requireApiKey()` instead of `requireSession()`) — the Public API is a new authentication front door onto existing business logic, never a second implementation of it.

### 21.7 Data Flow
`Third-party request → requireApiKey() → rate-limit check → org-scoped business logic (shared with the internal app) → standardized JSON response`. For webhooks: `Business event (e.g., quote.accepted, already firing Activity/Notification/Automation per Sections 6/15) → one additional call, dispatchWebhooks(eventType, payload, organizationId) → for each active, subscribed Webhook → WebhookDelivery row (PENDING) → HMAC-signed POST → on failure, capped retry with backoff, same shape as Section 11.10's email retry`.

### 21.8 Permission Model
Scopes are a fixed, closed list (Section 7.2.3): `leads:read`/`leads:write`, `quotes:read`/`quotes:write`, `jobs:read`/`jobs:write`, `invoices:read`/`invoices:write`, `customers:read`/`customers:write`, `webhooks:manage`. An `ApiKey` is created with an explicit, `OWNER`-chosen subset — never "all scopes" by default — so a third-party integration gets exactly the access it was granted, never more, mirroring the principle-of-least-privilege spirit of the existing `Role` model without conflating API scopes with staff roles (an API key has no `Role`; it has scopes, which is the correct primitive for a non-human caller).

### 21.9 Security Considerations
- Keys are stored **hashed** (bcrypt), identical discipline to `PortalAccessToken` (Section 12.9) and to staff passwords (Phase 3 §9.1) — a database compromise alone cannot yield a usable key.
- `keyPrefix` enables an indexed narrowing step before the bcrypt-compare loop, keeping authentication fast without ever storing the full key in a searchable, un-hashed form.
- Every webhook payload is HMAC-signed with the `Webhook.secret` (shown once at creation, never re-displayed) so a receiving endpoint can verify authenticity — the same signing discipline already used for the Phase 5 Quote share-link token, applied to a new surface.
- Rate limiting (Section 21.11) is a hard requirement, not an enhancement — an unauthenticated or low-effort brute-force attempt against the key-comparison endpoint is bounded by request volume per key/IP before it can meaningfully iterate.
- The API never exposes an endpoint with no scope requirement; there is no "public, no-key" route under `/api/v1/*` — `api/lead-capture` (Phase 3, public, rate-limited, unauthenticated by design for inbound lead forms) is explicitly a different, frozen, unrelated route and is not part of this versioned API surface.

### 21.10 Error Handling & Validation
A single standardized error envelope: `{ error: { code: string, message: string } }` with conventional HTTP status codes (401/403/404/422/429/500) — every handler throws a typed `ApiError(status, code)` caught by one shared wrapper, so no handler hand-rolls its own error shape. Input validation reuses the same Zod schemas the internal `features/<entity>/schema.ts` files already define (Section 28 of the Phase 5 document) — not a second, parallel validation layer.

### 21.11 Performance & Caching Strategy
**Rate limiting, V1 (zero new infrastructure):** `DbRateLimiter` (Section 21.6) implements `checkLimit()` as a sliding-window counter — a simple "count of requests for this `ApiKey` in the last 60 seconds" check, fronted by a small in-process LRU cache to avoid a DB round-trip on every single request while still bounding abuse. This is intentionally simple and good enough at the request volumes a Standard-tier client's integrations generate. List endpoints use offset pagination (page size capped at 100), the same posture Section 31 of the Phase 5 document already chose for internal `<DataTable>`s, for the same reason (cursor pagination is unneeded complexity at this scale).

### 21.12 Testing Strategy
Authentication tests (missing key, invalid key, revoked key, insufficient scope — each a distinct 401/403); a rate-limit test confirming the 429 threshold triggers correctly and resets after the window; an integration test confirming a `POST /api/v1/quotes` call produces an identical `Quote` row (and identical `Activity`/`Notification` side effects) to the equivalent internal-app action, since they share the same underlying function; a webhook delivery test confirming HMAC signature correctness and retry-on-failure behavior.

### 21.13 Future Extension Points — funding trigger
**Adopt Upstash Redis (or equivalent) when:** API request volume from real third-party integrations makes the V1 `DbRateLimiter`'s latency or accuracy insufficient — a measurable, observable trigger (rising `ApiKey`-table contention or rate-limit false positives/negatives), not a speculative upgrade. At that point: install `@upstash/ratelimit` + `@upstash/redis`, implement `UpstashRateLimiter` against the same `RateLimiter` interface (Section 21.6), flip `resolveRateLimiter()`'s one branch (e.g. via `RATE_LIMITER=upstash`) — zero change to any `/api/v1/*` route handler. A `v2` API path is the designed-for mechanism for any future breaking change; v1 routes are never modified once shipped, only deprecated alongside a new v2 path, consistent with the "never redesign a frozen surface" principle this entire document follows for Phases 1–5 — formalized below.

### 21.14 API Versioning Policy

- **`/api/v1/*` is frozen at release.** Once Step 13 of the roadmap (Section 29) ships and a single real third-party caller depends on it, no endpoint under `/api/v1/*` ever changes its request shape, response shape, status-code meaning, or authentication requirement. This is the same freeze discipline Section 1 applies to this document itself, applied to a wire contract instead of a planning artifact.
- **Additive, non-breaking changes may still land in `/api/v1/*`:** a new optional query parameter, a new field appended to a response object, a new endpoint, a new webhook event type. None of these break an existing integration that ignores fields it doesn't recognize — the same additive-only discipline Section 6 already applies to the Activity/Notification event taxonomy, applied here to the wire format.
- **Any breaking change — removing a field, renaming a field, changing a status code's meaning, changing required-vs-optional on a request field — ships only under `/api/v2/*`,** as a new, parallel route tree, never as a modification to `/api/v1/*`. `v1` and `v2` may run simultaneously for as long as any real integration still depends on `v1`.
- **Deprecation, when it eventually happens, is announced, not silent:** a deprecated `v1` endpoint continues to function and is never removed on a deadline alone — removal is a separate, explicit decision made once usage data (via `ApiKey.lastUsedAt`, already tracked per Section 7.2.3) shows no real caller depends on it.
- This policy applies starting from the first real external consumer of `/api/v1/*` — prior to that point (i.e., during Steps 12–13 of the roadmap, before any third party is using it), course corrections are still cheap and are not yet bound by this freeze.

---

## 22. Security Review

This section synthesizes cross-cutting security concerns; Sections 10–21 each already state their own subsystem-specific considerations and are not repeated here.

### 22.1 Three independent authentication planes, by design
Phase 6 introduces two new authentication planes alongside the frozen Phase 3 staff session: the Customer Portal session (Section 12) and the Public API key (Section 21). All three are deliberately **non-interchangeable**:

| Plane | Identity | Credential | Scope | Cannot reach |
|---|---|---|---|---|
| Staff session (Phase 3, frozen) | `User` | httpOnly JWT cookie, 7-day | `organizationId` + `Role` | Portal-only/API-only surfaces don't exist as a concept here — staff is the superset, gated by `Role` |
| Customer Portal session (Section 12) | `Customer` | httpOnly JWT cookie, distinct claim shape, 30-day | one `customerId` within one `organizationId` | Any internal `/`(dashboard)`/*` route or server action; any other customer's data |
| Public API key (Section 21) | none (machine caller) | hashed `ApiKey`, bearer header | `organizationId` + explicit scopes | Any UI route entirely (API-only); any scope not explicitly granted |

No code path decodes one plane's credential and accepts it as another's — `requireSession()`, `requirePortalSession()`, and `requireApiKey()` are three separate functions with three separate claim shapes, and no feature module imports more than one of them for a given request. This is stated once, here, as a standing architectural rule because it is the single most consequential security property this entire phase depends on.

### 22.2 Secret handling, summarized
- Staff passwords: bcrypt hash (frozen, Phase 3).
- `ApiKey`/`PortalAccessToken`: bcrypt hash (Sections 21.9/12.9) — never stored or logged in plaintext, never returned by any read endpoint after creation.
- `Webhook.secret`: stored once, shown once, used only for outbound HMAC signing — never returned by any list/read endpoint after creation.
- Third-party integration credentials (Section 20.9): never stored in `Integration.config`; a binding rule for every future adapter, stated now precisely so it can't be quietly violated later under deadline pressure.
- `AUTH_SECRET` is reused (never duplicated into a second secret) for both the frozen staff JWT and the new portal session JWT — fewer secrets to rotate and audit, with the two cookies kept non-interchangeable by claim shape, not by using different keys.

### 22.3 Tenant isolation, extended
Every new table in Section 7.2 carries `organizationId` directly (the same direct-column choice the frozen database document already made for every Phase 1–5 table, rather than relying on a join to infer it) — there is no Phase 6 query in this document that fetches a `FileAttachment`/`EmailLog`/`ApiKey`/`Webhook`/`Integration`/`AutomationRule`/`PortalAccessToken`/`AiUsageLog` row by ID alone without also filtering on `organizationId`, extending the IDOR-closing discipline Section 39 of the Phase 5 document already established to every new table.

### 22.4 Input/output trust boundaries
- AI prompts are built from already-scoped server data, never raw client input concatenated into a prompt (Section 16.9) — the AI-specific analog of "never trust client-submitted money values" (Section 6 of the Phase 5 document, carried forward).
- Automation `conditions`/`actions` are structured, schema-validated JSON against a closed operator/action-type set — never an `eval`-able string (Section 15.9).
- Email templates render via typed functions with escaped interpolation, never string concatenation (Section 11.9).
- Pasted file URLs are stored and rendered as plain links/`<img src>`, never server-side fetched/proxied — no SSRF surface under the zero-cost `UrlPasteProvider` (Section 14.9).

### 22.5 Abuse and rate-limiting surface
The Public API (Section 21.11) and `PortalAccessToken` redemption (Section 12, an unauthenticated-until-redeemed endpoint) are the two genuinely new abuse surfaces this phase introduces, since both accept unauthenticated or pre-authenticated requests from outside the trusted staff session. Both are rate-limited (per-key for the API; a generic per-IP limiter on `/portal/login`, reusing the same rate-limiting primitive Phase 3 already specified for `/api/lead-capture`) and both fail closed with a generic message rather than a distinguishing one (Section 12.10's "no enumeration" rule, extended identically to API key validation failures).

### 22.6 What this section deliberately does not cover
A real third-party integration's specific OAuth flow, a real payment processor's PCI scope, and a real AI provider's own data-handling terms are explicitly **not** reviewed here, because none are built in this phase (Section 5) — each becomes its own security review at the point it's actually adopted, scoped to that one adapter, not retrofitted onto this document speculatively.

## 23. Performance Strategy

Carries forward Section 37 of the Phase 5 document's rules (every query through `requireCompanyScope()` + an indexed column; no `include` beyond one relation level on list screens; aggregate queries as single statements, never N+1) and extends them to Phase 6's new query shapes.

- **New indexes** are exactly the ones declared inline in Section 7.2's table definitions — no additional index is needed beyond those for anything specified in this document.
- **Document Generation (Section 10)** is CPU-bound (PDF layout/render), not DB-bound, and runs as a stateless serverless function invocation — it does not compete with the DB connection pool the way a list-page query does, and scales horizontally for free on the existing Vercel deployment model with zero additional configuration.
- **Email/Webhook dispatch (Sections 11/21)** are fire-and-forget relative to the triggering business action — the action's own response time is never blocked waiting on `provider.send()`/`deliverWebhook()` to complete; both run as a logged, retryable side effect, the same "side effects after the conditional write" sequencing Section 30 of the Phase 5 document already established for Activity/Notification.
- **Automation Engine (Section 15)** rule lookups are filtered by the new `(organizationId, triggerType, isActive)` index and cached (`automation-rules-${organizationId}`) — evaluating rules adds one cached lookup plus N small condition checks to an already-executing action, not a new heavy query.
- **AI Layer (Section 16)** calls are external-network-bound when a real provider is active; they are explicitly not on any critical path that blocks a save — the existing field's save action completes independent of whether a suggestion was requested.
- **Public API (Section 21)** pagination is capped offset-based (page size ≤ 100), matching the internal `<DataTable>` posture exactly, for the same scale-appropriate reasoning.

## 24. Scalability Strategy

The frozen database document already names the real scaling axis for this product: most deployments are one `Organization` row per deployed instance (bespoke-per-client delivery), with row-level tenancy kept as "insurance" rather than a today-requirement. Phase 6 does not change that delivery model, but it does make a genuinely shared, multi-tenant hosted deployment more plausible — which is exactly the scenario the frozen document flagged as the one case where row-level isolation stops being insurance and starts being load-bearing. Phase 6's scalability posture is therefore:

1. **Per-client instance scaling (the current, primary model):** every Phase 6 subsystem's load is bounded by one organization's data volume — Standard-tier client sizes (5–30 employees) never approach a scale where the live-read, no-summary-table posture (Sections 17.11/18.11) becomes a bottleneck. No action needed.
2. **Shared multi-tenant hosted scaling (a named future path, not built now):** if QuoteFlow is ever offered as a single shared deployment serving many client organizations at once (rather than one instance per client), the row-level `organizationId` discipline already in place across every Phase 1–6 table is precisely what makes that transition safe — every query in this document is already written as if other organizations' rows exist in the same tables, because in the frozen schema's design, they always could.
3. **Stateless compute scales for free:** Document Generation and the Public API's read endpoints are both stateless request/response cycles on serverless infrastructure — adding load adds concurrent invocations, not a capacity-planning exercise, under the existing Vercel hosting model.
4. **Stateful bottlenecks are isolated and named:** the only genuinely stateful, potentially-contended resources Phase 6 introduces are the Postgres connection pool (unchanged scaling story from Phase 1–5, Neon's existing pooling) and, if adopted, a Redis-backed rate limiter (Section 21.13) — both are independently scalable infrastructure decisions, not application-architecture constraints.
5. **Webhook/email retry queues do not require a dedicated queue service at this scale:** the capped-backoff, DB-row-driven retry pattern (Sections 11.10/21.7) is sufficient for Standard-tier delivery volumes; a dedicated queue (e.g., a managed message queue) is a named, explicit upgrade path if a client's webhook/email volume ever outgrows it — not provisioned speculatively.

## 25. Testing Strategy

Extends, rather than replaces, Section 40 of the Phase 5 document's four-layer table.

| Layer | Tool | Phase 6 additions |
|---|---|---|
| Unit | Vitest | PDF template snapshot tests (Section 10.12); email template interpolation/escaping (11.12); token issuance/expiry/revocation (12.12); conflict-detection date-overlap logic (13.12); URL validation (14.12); condition-evaluator operators (15.12); `NullAIProvider` short-circuit (16.12); aging-bucket boundaries (18.12); preference-default behavior (19.12); registry unknown-key handling (20.12); API auth/scope/rate-limit edge cases (21.12) |
| Integration | Vitest + Prisma test DB | Portal-scope cross-customer/cross-org isolation (12.12); FIELD-cannot-reschedule (13.12); FIELD-scoped file attachment (14.12); automation fire-without-rollback (15.12); AI usage logging on mocked provider call (16.12); financial-report role gating (18.12); muted-type email suppression (19.12); API-write-equals-internal-action-equivalence (21.12); webhook HMAC + retry (21.12) |
| Component | React Testing Library | `RuleBuilder` condition/action row composition; `CalendarGrid` drag interaction with optimistic rollback on conflict; `AiDraftPanel` Accept/Discard; `CreateApiKeyDialog`/`CreateWebhookDialog` one-time-secret-display UX |
| E2E | Playwright | **Extended pipeline:** the existing Phase 5 flow (register → lead → quote → accept → job → invoice → payment) **plus**: staff issues a Portal link → customer opens it → views Invoice + pays-status → updates contact info, reflected back in the internal Customer record; staff creates an `AutomationRule` ("Quote accepted, total ≥ $5,000 → notify Owner") → accepting a matching Quote fires it, logged in `AutomationLog`; a third-party script authenticates with an `ApiKey` → creates a Lead via `/api/v1/leads` → it appears in the internal app identically to one entered through the UI |

Import-boundary tests (Section 12.12) — confirming the portal module never imports `requireSession`/`requireRole` and the internal app never imports `requirePortalSession`/`requireApiKey` — are treated as a first-class, CI-enforced test category, not an informal code-review convention, given how much of Section 22's security posture depends on that separation holding.

## 26. Risks

| Risk | Mitigation |
|---|---|
| Three authentication planes (staff/portal/API) accidentally cross-wired by a future engineer reusing a helper out of convenience | Disjoint claim shapes + CI-enforced import-boundary tests (Section 25), not just naming convention or code review discipline alone |
| Automation Engine misconfigured by an Owner into a runaway loop (e.g., a rule whose action re-triggers its own condition) | `AutomationLog`'s per-rule, per-entity logging makes any loop immediately visible; V1's action set (`send_notification`/`send_email`/`create_task`/`log_activity`) contains no action type that can itself re-fire a status-transition trigger, closing the most dangerous loop shape (an action that mutates the triggering entity's own status) by construction rather than by runtime guard alone |
| AI feature cost overrun once a real provider is funded | `AiUsageLog` makes cost observable from the first real call (Section 16.13); the feature-flag gate means cost is opt-in per organization, never accidentally incurred |
| Webhook delivery becoming an unbounded retry storm against an unresponsive third-party endpoint | Capped attempts + exponential backoff (Section 21.7), identical pattern to the email retry policy already designed in Section 11.10 |
| Customer Portal link shared insecurely by staff (e.g., pasted into a public forum) | Tokens are scoped to exactly one customer's data, expirable, and instantly revocable (Section 12.9) — the blast radius of a leaked link is one customer's own records, never another's, and is fully containable after the fact |
| `Job.scheduledEndAt` being optional means conflict detection is incomplete for any Job created before this column is populated | Explicitly documented as the accepted behavior (Section 13.3) — a point-in-time Job simply can't conflict on duration, which is a strict subset of what the old behavior already showed, never a regression |
| Provider Adapter Pattern becoming an excuse to over-engineer subsystems that will never actually need a second provider | Every interface in this document (`EmailProvider`, `StorageProvider`, `AIProvider`, `IntegrationProvider`) has exactly one real-today implementation and one explicitly-named, concretely-triggered future one (Sections 11.13/14.13/16.13/20.13) — never a speculative N-provider abstraction with no named second user |
| Vendor lock-in risk from designing too tightly around Vercel/Neon-specific features (e.g., Vercel Cron, Vercel Blob) | Every Vercel-specific choice is named explicitly as such and isolated behind its subsystem's own adapter interface (Sections 14/15/21) — swapping hosting providers later would mean rewriting adapters, never rewriting feature modules |

## 27. Future Extension Points

Consolidates every subsystem's named funding-trigger/future-option (Sections 10.13–21.13) and adds the cross-cutting ones not specific to a single subsystem:

- **Real third-party integrations** (QuickBooks, Stripe, Google Calendar, Twilio SMS, a generic CRM) — each a new `IntegrationProvider` file plus one registry entry (Section 20.13); zero framework change per integration.
- **Real payment processing** — explicitly out of scope for Phase 6 (Section 5); when funded, modeled as a `payment_provider` `IntegrationProvider` whose `connect()` flow links a Stripe (or similar) account, after which `recordPayment()` gains an optional "charge now" path alongside its existing manual-entry path — a Phase 7+ design, not opened here.
- **A hosted, genuinely shared multi-tenant deployment** of QuoteFlow itself, as a product offering distinct from the current bespoke-per-client model — made safer, not harder, by every Phase 1–6 table already carrying `organizationId` directly (Section 24.2).
- **Public API v2** — the designed-for mechanism (Section 21.13) for any future breaking change, alongside v1, never replacing it.
- **A richer, visual Automation rule-builder UI** (drag-and-drop trigger/condition/action blocks) — independent of and not blocked by this document's data model (Section 15.13).
- **Scheduled/cron-driven proactive automation and email retry**, once Vercel Cron (or an equivalent) is funded (Sections 11.10/15.13) — the single most-named "next thing to fund" across this entire document, appearing in Email, Automation, and Notification sections alike.
- **Statistical (not linear) revenue forecasting**, gated behind the AI Layer (Section 16) rather than a bespoke forecasting model.
- **A true job-costing profitability report**, gated on a future, explicitly-justified schema addition (Section 18.13) — not built speculatively now.
- **SMS as a notification channel**, generalizing the `EmailProvider`-shaped pattern into a `NotificationChannel` interface (Section 19.13).
- Every future extension point already named and not superseded by Phase 6 in Phases 1–5's own documents (bulk row actions, Kanban drag-and-drop, recurring/templated Jobs, pre-computed report summary tables, `ServiceCategory` nesting, `PriceList`, `CustomerContact`, scoped-rep visibility) remains exactly as deferred as those documents left it — nothing in Phase 6 forecloses or accelerates any of them.
## 28. Definition of Done

- [ ] Every subsystem in Sections 10–21 is implemented exactly as specified, with no frozen Phase 1–5 table, column, enum, route, server action, or component altered, renamed, or removed.
- [ ] Every schema addition matches Section 7.2 exactly — nine new tables, one new column on `Job` (`scheduledEndAt`), one new column on `User` (`notificationPreferences`) — and nothing else.
- [ ] Every paid-provider-capable subsystem (Email, File Storage, AI, Integrations, API rate limiting) ships with its zero-cost default adapter active and its funded adapter written-but-unwired, per Sections 11.13/14.13/16.13/20.13/21.13.
- [ ] Every adapter named in Section 6.1 (`EmailProvider`, `StorageProvider`, `AIProvider`, `IntegrationProvider`, `RateLimiter`, `DocumentRenderer`) follows the same four-part interface convention — one interface, one default implementation, one resolver function, zero conditional branching in any consuming feature module — verified by code review against Section 6.1's table, not assumed.
- [ ] Disabling AI (`aiEnabled = false`, the default) is verified to leave every workflow fully functional with zero behavior change versus a build with no AI code present at all (Section 16.1).
- [ ] The API Versioning Policy (Section 21.14) is recorded and understood by whoever ships the first `/api/v1/*` write endpoint to a real external caller — no breaking change lands under `/api/v1/*` from that point forward.
- [ ] The three authentication planes (staff session, portal session, API key) are independently implemented, independently tested, and verified by an import-boundary test to be non-interchangeable (Sections 22.1, 25).
- [ ] Every new query in every new table passes through an `organizationId` filter — verified by the same IDOR-closing discipline check Phase 5 already applied, extended to every Section 7.2 table.
- [ ] The Customer Portal cannot reach any internal-app route or server action, and the internal app shares no session state with it — both directions tested (Section 12.12).
- [ ] The Public API's write endpoints call the exact same internal business-logic functions the staff UI calls — verified by an equivalence test (Section 25), not merely asserted by code review.
- [ ] `AutomationLog`, `EmailLog`, and `AiUsageLog` are written on every relevant action regardless of success/failure/skip outcome — observability exists from the first call, not retrofitted later.
- [ ] Money, status, and entity ownership remain server-authoritative everywhere a Phase 6 surface touches them (PDF rendering, Portal display, API responses, Automation actions) — no new code path trusts a client-, customer-, or third-party-supplied total or status.
- [ ] The full extended E2E flow in Section 25 passes.
- [ ] All gates pass: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- [ ] This document's status line is updated to **"Phase 6 — Frozen v1.0, completed [date]."**

## 29. Step-by-Step Implementation Roadmap

### Step 0 — Pre-Implementation Verification
- **Objective:** Mechanically confirm every assumption this document makes against the live, frozen schema and codebase before writing any new code — the same discipline Phase 3's §27 and Phase 4's reconciliation pass already proved necessary.
- **Prerequisites:** none beyond Phase 5 being frozen and implemented.
- **Deliverables:** a short addendum (in the style of Phase 3's §27 Addendum) confirming: `Job.scheduledDate`'s exact type; `Customer.email`/`phone`/`address`'s exact nullability and shape; `Activity.createdById`'s FK constraint (confirming the portal-attribution fallback design in Section 12.9 is necessary, not assumed); `lib/tokens.ts`'s exported surface (confirming it is reused for nothing in Phase 6, per Section 7.2.7's explicit non-modification); `AUTH_SECRET`'s availability to a new module; the exact current `Organization.settings.featureFlags` shape (Phase 4 §5) before adding `aiEnabled`/`emailProviderEnabled` keys to it.
- **Verification:** every item above resolves to a confirmed name/shape with no open question; any mismatch is recorded as a one-line documentation addendum here, not silently worked around in later steps.
- **Completion criteria:** addendum committed; no frozen-schema assumption in this document is left unverified.

### Step 1 — Schema Migration
- **Objective:** Add all nine new tables and two new columns (Section 7.2) in a single migration.
- **Prerequisites:** Step 0.
- **Deliverables:** one Prisma migration; `npx prisma generate` run; no data migration needed (every new column is nullable/defaulted, every new table starts empty).
- **Verification:** migration applies cleanly against a copy of the live schema; `npx prisma migrate diff` confirms zero changes to any frozen table beyond the two named additive columns.
- **Completion criteria:** PR merged. This is the only step that touches `schema.prisma`; every subsequent step is pure application code.

### Step 2 — Document Generation
- **Objective:** Implement `lib/pdf/` primitives and the five document templates (Quote, Invoice, Job Sheet, Work Order, Receipt), per Section 10.
- **Prerequisites:** Step 1 (none of its own tables needed, but ordered early since Email/Portal templates in later steps may reference shared `lib/pdf` theme primitives).
- **Deliverables:** `features/documents/*`; the internal render route.
- **Verification:** snapshot tests per template; a FIELD-scope test on Job Sheet/Work Order rendering.
- **Completion criteria:** PR merged; a staff member can download a branded PDF for any Quote/Invoice/Job/Receipt from its detail page.

### Step 3 — File & Media Management
- **Objective:** `FileAttachment` CRUD with `UrlPasteProvider`, per Section 14.
- **Prerequisites:** Step 1.
- **Deliverables:** `features/files/{providers/, actions.ts, queries.ts}` additions; `FileAttachmentList` component wired into every entity detail page's tab shell, alongside Activity/Notes/Tasks.
- **Verification:** FIELD-scoped attach test (own Job only); URL-validation unit tests.
- **Completion criteria:** PR merged.

### Step 4 — Email Architecture
- **Objective:** `EmailProvider` interface, `ConsoleEmailProvider`, `EmailLog`, and the core template set, per Section 11.
- **Prerequisites:** Step 1.
- **Deliverables:** `features/email/*`; `EmailHistoryList` component on entity detail pages.
- **Verification:** template-interpolation/escaping unit tests; an `EmailLog`-always-written integration test regardless of provider outcome.
- **Completion criteria:** PR merged; no real email is sent; every "would-be-sent" email is visible in server logs and in `EmailLog`.

### Step 5 — Notification Expansion
- **Objective:** `User.notificationPreferences`, the email fan-out wrapper, and new Phase 6 event `type` values, per Section 19.
- **Prerequisites:** Step 4 (the email fan-out calls Section 4's `sendTemplatedEmail()`).
- **Deliverables:** `features/notifications/{dispatch.ts, preferences.ts}`; `NotificationPreferencesForm`.
- **Verification:** null-default preference test; muted-type suppression test.
- **Completion criteria:** PR merged.

### Step 6 — Customer Portal
- **Objective:** `PortalAccessToken`, portal session signing, the full `(portal)` route group, and the portal-scoped accept/decline/contact-update actions, per Section 12.
- **Prerequisites:** Steps 2 (PDF download from the portal), 4 (future email-delivered links, not wired yet).
- **Deliverables:** `features/customer-portal/*`; `app/(portal)/*`; the new `middleware.ts` route-classification entries for `/portal/*`.
- **Verification:** token lifecycle unit tests; cross-customer/cross-org isolation integration test; import-boundary test (Section 25); the staff-issues-link → customer-views/accepts E2E flow.
- **Completion criteria:** PR merged; this is the single highest-risk step in this phase (new authentication plane) and is reviewed against Section 22.1 explicitly before merge.

### Step 7 — Scheduling & Calendar
- **Objective:** `Job.scheduledEndAt` usage, `/schedule` multi-technician view, conflict detection, drag-and-drop, per Section 13.
- **Prerequisites:** Step 1.
- **Deliverables:** `features/schedule/*`; `/schedule` route.
- **Verification:** conflict-detection unit tests (overlap, adjacent, no-end-date); FIELD-cannot-reschedule integration test; drag-and-drop component test with rollback-on-conflict.
- **Completion criteria:** PR merged; `/jobs/calendar` (Phase 5, frozen) is verified unchanged and still functional.

### Step 8 — Automation Engine
- **Objective:** `AutomationRule`/`AutomationLog`, `engine.ts`, the four V1 action types, and the additive `fireTrigger()` call sites inside existing Phase 5 actions, per Section 15.
- **Prerequisites:** Steps 4 (`send_email` action type), 5 (`send_notification` action type).
- **Deliverables:** `features/automation/*`; one new line added to each of `acceptQuote()`, `declineQuote()`, `recordPayment()`, the Job-completion action, and the existing on-read overdue-detection query — each calling `fireTrigger()` additively, with zero change to those functions' existing behavior.
- **Verification:** condition-evaluator unit tests; skip-vs-fire-vs-fail integration tests; a regression test confirming every Phase 5 E2E flow (Section 40 of that document) still passes unchanged with `fireTrigger()` calls added.
- **Completion criteria:** PR merged.

### Step 9 — Dashboard Expansion
- **Objective:** Forecast, technician performance, sales performance, and pipeline-depth widgets, per Section 17.
- **Prerequisites:** Steps 6–8 (richer data — portal views, schedule, automation — makes some widgets meaningful sooner, though none strictly depend on them).
- **Deliverables:** new widget components and queries added to `features/dashboard/`.
- **Verification:** aggregate-query edge-case unit tests; financial-widget role-gate test.
- **Completion criteria:** PR merged.

### Step 10 — Reporting Expansion
- **Objective:** Profitability, utilization, acceptance-trend, CLV, aging, and tax-summary reports, per Section 18.
- **Prerequisites:** Step 1.
- **Deliverables:** new report tabs and queries added to `features/reports/`.
- **Verification:** aging-bucket boundary tests; financial-report role-gate tests; CSV-export correctness per new report.
- **Completion criteria:** PR merged.

### Step 11 — Integration Framework
- **Objective:** The `IntegrationProvider` interface, the (empty) registry, `Integration` CRUD, and the Settings → Integrations screen, per Section 20.
- **Prerequisites:** Step 1.
- **Deliverables:** `features/integrations/*`.
- **Verification:** unknown-provider-key graceful-failure test; `OWNER`-only gate test.
- **Completion criteria:** PR merged; zero real integrations are connected — the screen lists the framework's readiness, not live connections.

### Step 12 — Public API Core (Authentication + Read Endpoints)
- **Objective:** `ApiKey`, `requireApiKey()`, the V1 DB-backed rate limiter, and read-only `/api/v1/*` endpoints for Leads/Quotes/Jobs/Invoices/Customers, per Section 21.
- **Prerequisites:** Step 1.
- **Deliverables:** `features/api-keys/*`; `lib/api/auth.ts`; `lib/rate-limit/db-rate-limiter.ts`; `app/api/v1/{leads,quotes,jobs,invoices,customers}/route.ts` (GET only).
- **Verification:** the full authentication-failure matrix (missing/invalid/revoked key, insufficient scope); rate-limit threshold/reset test.
- **Completion criteria:** PR merged.

### Step 13 — Public API Write Endpoints & Webhooks
- **Objective:** `POST`/`PATCH` endpoints calling the same internal business-logic functions; `Webhook`/`WebhookDelivery`, HMAC signing, and retry dispatch, per Section 21.
- **Prerequisites:** Step 12.
- **Deliverables:** write handlers under `app/api/v1/*`; `features/webhooks/*`; the `dispatchWebhooks()` call sites added additively alongside Step 8's `fireTrigger()` call sites (same event taxonomy, two consumers).
- **Verification:** the API-write-equals-internal-action equivalence test (Section 25); HMAC signature verification test; retry-with-backoff test.
- **Completion criteria:** PR merged; this is the second-highest-risk step in this phase (a new write surface onto production business logic) and is reviewed against Section 22 explicitly before merge.

### Step 14 — AI Layer
- **Objective:** `AIProvider` interface, `NullAIProvider`, `AiUsageLog`, the feature-flag gate, and the (initially invisible) `AiSuggestButton`/`AiDraftPanel` components, per Section 16.
- **Prerequisites:** Step 1.
- **Deliverables:** `features/ai/*`; the `aiEnabled` key added to the existing `Organization.settings.featureFlags` shape (Phase 4 §5) — additive, no migration, consistent with how Phase 4 already designed that JSON section to be extended.
- **Verification:** flag-off-means-zero-network-call test; usage-logging-on-mocked-provider-call test.
- **Completion criteria:** PR merged; `aiEnabled` defaults to `false` for every organization, including every existing one, with no backfill required.

### Step 15 — Cross-Cutting Integration Pass, Full E2E, and Definition of Done Verification
- **Objective:** Wire every remaining additive touch point this document names but defers to "last" by nature (e.g., confirming every Section 7.2 table's Activity/Notification integration is complete; confirming the extended E2E flow in Section 25 passes end-to-end); final pass against every item in Section 28.
- **Prerequisites:** Steps 0–14.
- **Deliverables:** the full extended Playwright suite (Section 25); this document's status line updated to Frozen v1.0.
- **Verification:** full CI run (lint/typecheck/test/build) green; manual QA across all three authentication planes (staff at all three roles, a redeemed portal session, an API key at each scope combination); a final read-through confirming no frozen Phase 1–5 artifact was touched anywhere in the diff.
- **Completion criteria:** Phase 6 sign-off; this document becomes the frozen implementation specification for Phase 6, and Phase 7 planning may begin.
