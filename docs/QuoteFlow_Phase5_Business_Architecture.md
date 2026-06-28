# QuoteFlow — Phase 5: Business Modules Architecture
### Canonical Reference for Phase 5 Implementation

## Document Control

| | |
|---|---|
| **Status** | **Phase 5 — Frozen v1.0, completed 2026-06-28** |
| **Version** | 1.0 |
| **Phase** | 5 — Business Modules (Lead → Quote → Job → Invoice) |
| **Depends on** | Phase 1 (Project Foundation), Phase 2 (Database Architecture — frozen), Phase 3 (Authentication Architecture — frozen v2.0), Phase 4 (Core Business Foundation — frozen v2.1) |
| **Consumed by** | Phase 6+ (Reports depth, AI features, Premium/Enterprise upgrade paths) |
| **Owner** | Development OS (Architecture) |
| **Audience** | Any engineer implementing Phase 5, with no other context than this document and the three frozen documents it depends on |

No application code, migrations, or packages are introduced by this document. It is a planning artifact only.

---

## 1. Executive Summary

Phase 5 turns QuoteFlow from a platform shell into the actual product: the Lead → Quote → Job → Invoice → Payment pipeline a contractor business runs on every day. Phases 1–4 built everything this phase consumes — auth, tenancy, the frozen 16-entity schema, layout primitives, the Configuration Service, Activity/Notes/Tasks, Notifications, Search, DataTable, and Export. Phase 5's job is to wire real screens and server actions to that real schema, using the platform's existing contracts rather than inventing parallel ones.

Nothing in this document changes the frozen schema beyond what's explicitly logged as a gap in Section 35 (Business Rules) and resolved without a migration. Where the schema already gives an answer (e.g., `Invoice` is deliberately 1-to-many off `Job`), this document follows it rather than re-litigating it.

---

## 2. Goals

1. Implement the full business pipeline: Lead, Customer, Quote (+ Quote Builder), Job, Invoice, Payment, and the shared Catalog (Service, ServiceCategory, TaxRate, LeadSource).
2. Reuse every Phase 4 platform service as-is: `requireCompanyScope()`/`requireRole()`, `lib/config`, `lib/numbering`, Activity/Notes/Tasks, Notifications, Search, `<DataTable>`, Exporter.
3. Define the status lifecycle and the transition rules for Lead, Quote, Job, and Invoice precisely enough that an implementer never has to guess what a status change is allowed to do.
4. Define one consistent permission model across all six new modules, expressed in terms of the real `Role` enum (`OWNER`/`STAFF`/`FIELD`).
5. Keep every new screen, table, and server action inside the existing `features/<entity>/` vertical-slice convention.
6. Produce a roadmap granular enough to implement and verify one step at a time, lowest-risk-first.

## 3. Scope

In scope: Lead module, Customer module, Catalog (Service/ServiceCategory/TaxRate/LeadSource), Quote module + Quote Builder, Job module, Invoice + Payment module, Dashboard, Reports (first tier), and the integration glue connecting all of the above to Activity, Notifications, Search, Export, and DataTable.

## 4. Non-Goals

- No schema changes beyond what Section 35 documents and resolves without a migration.
- No real email delivery (quote-sent / invoice-due reminders remain in-app only — Resend is still deferred per the zero-cost build plan).
- No scheduled/cron jobs (e.g., "invoice is now overdue" is computed on read, not pushed by a background job — no cron runner exists yet).
- No AI features (quote-suggestion, lead-scoring) — explicitly Phase 6+.
- No `ServiceCategory` nesting, no `PriceList`, no `CustomerContact`, no scoped-rep visibility tier, no soft delete, no `AuditLog` — all remain deferred exactly as the frozen database and Phase 4 documents already decided.
- No bulk row actions (multi-select bulk-status-change, bulk-export-selected) — single-record actions only in this phase; bulk operations are a documented future extension (Section 42).

## 5. Architecture Principles

| Principle | How Phase 5 honors it |
|---|---|
| Frozen schema as a hard constraint | Every model, field, and enum used below is copied verbatim from `QuoteFlow_Standard_Package_Database_Architecture.md`. No field is renamed, retyped, or added without an explicit, logged gap (Section 35). |
| Reuse, never duplicate | Activity, Notes, Tasks, Notifications, Search, DataTable, Export, Configuration Service, numbering, and permission helpers are consumed exactly as Phase 4 built them. No module reimplements a platform service. |
| Vertical slices | Every module lives in its own `features/<entity>/` folder: `components/`, `actions.ts`, `queries.ts`, `schema.ts`. Cross-module logic (e.g., "accepting a Quote creates a Job") lives in the action of the module that owns the transition (Quote), which then calls the other module's exported creation function — never duplicated business logic. |
| Server-authoritative money and status | Every total, tax calculation, and status transition is computed and validated server-side. The client never sends a `total` or a `status` directly — only the inputs (`line items`, `the requested transition`) the server needs to derive them. |
| Decimal correctness | All money fields are Prisma `Decimal`. Server-side arithmetic uses `Decimal` (via `@prisma/client`'s re-exported `Decimal.js`), never native `number`/`Float`, to avoid floating-point drift on totals. |
| Optimistic-concurrency safety on status | Every status transition is a conditional update (`WHERE id = ? AND status = ?`), not a blind write — this is what makes "Quote already accepted by someone else" a clean, detectable error instead of a silent double-accept. |

## 6. Business Domain Overview

```
   Lead ──────────────► Quote ──────────────► Job ──────────────► Invoice ──*── Payment
    │  (status: NEW       │ (status: DRAFT       │ (status:           │ (status: UNPAID
    │   CONTACTED          │  SENT VIEWED         │  SCHEDULED          │  PARTIAL PAID,
    │   QUOTED WON LOST)   │  ACCEPTED DECLINED   │  IN_PROGRESS        │  derived from
    │                      │  EXPIRED)            │  COMPLETED          │  Payment sum)
    │                      │                      │  CANCELLED)         │
    └──────────► Customer ◄┴──────────────────────┴─────────────────────┘
                 (created from a WON Lead, or created directly for repeat/walk-in business)
```

Catalog (Service, ServiceCategory, TaxRate) and LeadSource are reference data consumed by Lead and Quote but owned by neither — they get their own module (Section 19) because every other module depends on them and they must exist first.

Activity, Note, Task, and Notification are cross-cutting (Section 24–25) and attach to any of Lead/Quote/Job/Customer/Invoice via the real `EntityType` enum.

## 7. Complete Module Breakdown

| Module | Owns | Primary entities | Depends on |
|---|---|---|---|
| Catalog | Reference data screens | `Service`, `ServiceCategory`, `TaxRate`, `LeadSource` | Phase 4 platform only |
| Customers | Customer record, lifetime value | `Customer` | Catalog (none directly), Activity/Notes/Tasks |
| Leads | Pipeline, lead capture, assignment, loss tracking | `Lead` | Catalog (`LeadSource`), Customers (conversion target) |
| Quotes | Quote lifecycle, Quote Builder, revisions | `Quote`, `QuoteItem` | Catalog (`Service`, `TaxRate`), Leads, Customers, `lib/numbering` |
| Jobs | Scheduling, technician assignment, completion | `Job` | Quotes (created on accept), Customers |
| Invoices | Billing, payment recording, AR | `Invoice`, `Payment` | Jobs, Customers, `lib/numbering` |
| Dashboard | Org-wide KPIs and pipeline visualization | reads across all of the above | All modules (read-only) |
| Reports | Turnaround, loss-pattern, revenue, lead-source ROI | reads across all of the above | All modules (read-only) |

## 8. Entity Relationships

```
Organization
 ├─ 1───* User
 ├─ 1───* Customer
 ├─ 1───* ServiceCategory ──1───* Service ──*──1 TaxRate (optional override)
 ├─ 1───* LeadSource
 ├─ 1───* Lead ──(0/1)── Customer
 │         └─ 1───* Quote
 ├─ 1───* Quote
 │         ├─ 1───* QuoteItem ──(0/1)── Service, ──(0/1)── TaxRate
 │         ├─ self: parentQuoteId → revision chain
 │         └─ 1───1 Job   (created only when status transitions to ACCEPTED)
 ├─ 1───* Job
 │         └─ 1───* Invoice   (intentionally 1-to-many — deposit / progress / final)
 │                   └─ 1───* Payment
 └─ Activity / Note / Task / Notification — *—1 Organization, *—1 one of [Lead|Quote|Job|Customer|Invoice]
```

This is unchanged from the frozen database architecture (Section 3 of that document) — restated here as the literal map Phase 5 builds against.

## 9. Folder Structure

```
src/
├── app/
│   └── (dashboard)/
│       ├── leads/
│       │   ├── page.tsx                  # list
│       │   └── [id]/page.tsx              # detail
│       ├── customers/
│       │   ├── page.tsx
│       │   └── [id]/page.tsx
│       ├── quotes/
│       │   ├── page.tsx
│       │   ├── new/page.tsx               # Quote Builder (create)
│       │   └── [id]/
│       │       ├── page.tsx               # detail / status timeline
│       │       └── edit/page.tsx          # Quote Builder (edit existing DRAFT)
│       ├── jobs/
│       │   ├── page.tsx                   # list
│       │   ├── calendar/page.tsx          # schedule view
│       │   └── [id]/page.tsx
│       ├── invoices/
│       │   ├── page.tsx
│       │   └── [id]/page.tsx
│       ├── catalog/
│       │   ├── services/page.tsx
│       │   ├── categories/page.tsx
│       │   ├── tax-rates/page.tsx
│       │   └── lead-sources/page.tsx
│       ├── dashboard/page.tsx
│       └── reports/page.tsx
├── features/
│   ├── leads/            {components/, actions.ts, queries.ts, schema.ts}
│   ├── customers/        {components/, actions.ts, queries.ts, schema.ts}
│   ├── quotes/           {components/, actions.ts, queries.ts, schema.ts, calculations.ts}
│   ├── quote-builder/    {components/, store.ts}        # client-only builder UI state (Zustand)
│   ├── jobs/             {components/, actions.ts, queries.ts, schema.ts}
│   ├── invoices/         {components/, actions.ts, queries.ts, schema.ts, calculations.ts}
│   ├── catalog/          {components/, actions.ts, queries.ts, schema.ts}   # Service/Category/TaxRate/LeadSource
│   ├── dashboard/        {components/, queries.ts}
│   ├── reports/          {components/, queries.ts}
│   ├── activity/         # Phase 4, unchanged
│   ├── notifications/     # Phase 4, unchanged
│   ├── search/            # Phase 4, extended (Section 26)
│   ├── tables/            # Phase 4, unchanged
│   ├── export/            # Phase 4, extended (Section 32)
│   └── layout/            # Phase 4, unchanged
└── lib/                  # Phase 4, unchanged (db, auth, permissions, numbering, config, logger)
```

`quote-builder` is split out from `quotes` because it is pure client-side editing state (line items being composed before save) and is reused identically for both "new quote" and "edit draft quote" — it has no server action of its own; it only prepares the payload that `quotes/actions.ts` validates and persists.

## 10. Navigation Architecture

Sidebar order (extends the Phase 4 shell, no new nav primitive needed): **Dashboard → Leads → Quotes → Jobs → Invoices → Customers → Reports → Catalog → Settings**. This matches the information architecture already defined in `QuoteFlow_Portfolio_Blueprint.md`, with "Catalog" added as the home for Services/Categories/Tax Rates/Lead Sources (previously implicit, now a real nav item since it's a real module).

Role-based nav visibility (reusing the Phase 3 role mapping, no new mechanism):
- `OWNER`: every item, plus Settings/Team.
- `STAFF`: every item except Settings/Team and Reports' org-financial-summary tab (Section 34).
- `FIELD`: Jobs only (filtered to assigned jobs), plus their own Notifications. No Leads/Quotes/Customers/Invoices/Catalog/Reports nav items.

## 11. Route Structure

| Route | Access | Notes |
|---|---|---|
| `/dashboard` | OWNER, STAFF | FIELD redirected to `/jobs` |
| `/leads`, `/leads/[id]` | OWNER, STAFF | |
| `/customers`, `/customers/[id]` | OWNER, STAFF | |
| `/quotes`, `/quotes/new`, `/quotes/[id]`, `/quotes/[id]/edit` | OWNER, STAFF | `/edit` only reachable while `status = DRAFT` |
| `/jobs`, `/jobs/calendar`, `/jobs/[id]` | OWNER, STAFF, FIELD | FIELD's list/detail server-filtered to `assignedToId = session.userId` |
| `/invoices`, `/invoices/[id]` | OWNER, STAFF | |
| `/catalog/*` | OWNER, STAFF | STAFF can read/use catalog items in Quote Builder; only OWNER can create/edit/deactivate catalog records |
| `/reports` | OWNER (full), STAFF (operational tabs only, no revenue) | |

Unauthorized access to any route follows the frozen Phase 3 pattern: redirect to dashboard/jobs with a toast, never a dead-end error page.

## 12. UI/UX Standards

All list screens use `<PageLayout>` → `<PageHeader title actions>` → `<PageContent>` → `<DataTable>` (Phase 4 primitives, unchanged). All detail screens use the same shell with a tabbed body: **Overview | Activity | Notes | Tasks** — identical tab set across Lead/Quote/Job/Customer/Invoice detail, since `<ActivityTimeline>`, `<NotesList>`, `<TaskList>` are entity-agnostic Phase 4 components keyed only by `entityType`/`entityId`. This guarantees visual and behavioral consistency without per-module custom work.

Status is always rendered as a colored `<StatusBadge status variant />`, one shared component with a per-enum color map (Section 22), never a raw string.

## 13. Shared Components

New, reusable across modules (live in `components/shared/`, not inside any one feature):

| Component | Purpose | Used by |
|---|---|---|
| `<StatusBadge>` | Color-coded status pill for any of the 4 status enums | Leads, Quotes, Jobs, Invoices |
| `<MoneyDisplay>` | Formats a `Decimal` using the org's `currency`/locale from `lib/config` | Quotes, Jobs, Invoices, Dashboard, Reports |
| `<AssigneeSelect>` | Role-filtered user picker (STAFF for Lead assignment, FIELD for Job assignment) | Leads, Jobs |
| `<EntityDetailTabs>` | The Overview/Activity/Notes/Tasks tab shell described in Section 12 | Every detail page |
| `<StatusTransitionMenu>` | Renders only the transitions valid from the current status (Section 22) and calls the matching server action | Leads, Quotes, Jobs, Invoices |

## 14. Lead Module Architecture

- **Entity:** `Lead { id, organizationId, name, email?, phone, sourceId?, status, lostReason?, assignedToId?, customerId?, createdAt, updatedAt }`.
- **List screen:** `<DataTable>` with columns Name, Phone, Source, Status, Assigned To, Created; filters by `status`, `sourceId`, `assignedToId`; default sort `createdAt desc`.
- **Detail screen:** Overview (editable contact fields, source, assignment), `<StatusTransitionMenu>`, list of Quotes for this lead, Activity/Notes/Tasks tabs.
- **Create:** manual form (`OWNER`/`STAFF`) — phone capture from the existing public `/api/lead-capture` route (Phase 4) also lands here, with `status = NEW`, `sourceId` from the form's UTM/source field if present.
- **Assignment:** `assignedToId` settable by `OWNER`/`STAFF` to any `STAFF` (not `FIELD` — leads are not field work). Reassignment is a single server action (`reassignLead`), logs an Activity entry (`assigned`), and fires a `lead_assigned` Notification to the new assignee.
- **Conversion to Customer:** when a Lead's first Quote is created, if `Lead.customerId` is null, the Quote creation flow either links an existing `Customer` (search-and-select) or creates a new one inline — `Lead.customerId` is then backfilled. A Lead can reach `WON` only once it has a linked Customer (enforced in the transition validator, Section 35).
- **Loss tracking:** transitioning to `LOST` requires `lostReason` (free text, required by the action's Zod schema when `status === "LOST"` — not a DB constraint, since the column stays nullable for every other status).

## 15. Customer Module Architecture

- **Entity:** `Customer { id, organizationId, name, type (INDIVIDUAL/BUSINESS), email?, phone?, address? (Json), createdAt, updatedAt }`.
- **List/detail:** standard `<DataTable>` + detail shell. Detail page additionally shows: linked Leads, all Quotes, all Jobs, all Invoices for this customer (four read-only sub-lists, each just a filtered query against the respective module's `queries.ts` — no duplicated fetch logic).
- **Lifetime value:** computed on read, not stored — `SUM(Invoice.amount) WHERE customerId = ? AND status != CANCELLED`-equivalent (Invoices have no CANCELLED status; sum across all non-deleted invoices for that customer). Computing on read avoids a denormalized counter that could drift; at Standard-tier row counts this is a single indexed aggregate query, not a performance concern (Section 37).
- **Address as `Json`:** rendered/edited as a small structured sub-form (street/city/state/postal/country) that serializes to the single `Json` column — consistent with the frozen schema's deliberate choice not to split billing/shipping.

## 16. Quote Module Architecture

- **Entity:** `Quote { id, organizationId, quoteNumber, leadId?, customerId, status, version, parentQuoteId?, discountType?, discountValue?, subtotal, taxAmount, total, currency, issueDate?, expiryDate?, sentAt?, viewedAt?, acceptedAt?, declinedAt?, createdById, assignedToId?, notes?, terms?, createdAt, updatedAt }`.
- **Creation (`createQuote`):** requires `customerId` (resolved per Section 14 if coming from a Lead); calls `getNextQuoteNumber(organizationId)` (Phase 4 `lib/numbering`) to assign `quoteNumber` at creation time, per the frozen lifecycle decision; `status` starts `DRAFT`; `version = 1`, `parentQuoteId = null`.
- **Revisions:** a new revision of an existing Quote (allowed from any terminal-ish status — `SENT`, `VIEWED`, `DECLINED`, `EXPIRED`, but not from `ACCEPTED`, which is final) creates a **new** `Quote` row: `parentQuoteId = original.id`, `version = original.version + 1`, fresh `quoteNumber` (a new sequence number, not a suffix — see Section 35, gap #1), `status = DRAFT`, line items copied from the original. The UI's quote detail page shows the full revision chain (walk `parentQuoteId` both directions) so "this is v2 of Q-1041" is always visible, even though each revision is its own numbered quote.
- **Discount:** `discountType` (`PERCENT`/`FIXED`) and `discountValue` apply at the quote level, after line-item subtotal, before tax — see Section 17 calculation order.
- **Sending:** `sendQuote` transitions `DRAFT → SENT`, sets `sentAt`. No real email is sent (Resend deferred); this produces a shareable read-only quote view link the customer opens, which is what drives `viewedAt`/`acceptedAt`/`declinedAt`.
- **Customer-facing view:** a public, token-based route (`/q/[token]`, token stored as a new minimal field — see Section 35, gap #2) that records `viewedAt` on first load (`SENT → VIEWED`) and exposes Accept/Decline actions that record `acceptedAt`/`declinedAt` and transition status, without requiring the customer to have a QuoteFlow account.

## 17. Quote Builder Architecture

Pure client-side composition surface (`features/quote-builder/store.ts`, Zustand — already in the stack) used by both `/quotes/new` and `/quotes/[id]/edit`:

- **State:** `customerId`, `leadId?`, array of line items `{ id (temp client id), serviceId?, description, quantity, unitPrice, taxRateId? }`, `discountType?`, `discountValue?`, `notes?`, `terms?`.
- **Adding a line item:** "from catalog" (pick a `Service` → pre-fills description/unitPrice/default `TaxRate`) or "custom" (blank row, `serviceId = null`).
- **Reordering:** drag-and-drop updates each row's `sortOrder` client-side; persisted on save.
- **Calculation order (server-recomputed on save, never trusted from client):**
  1. Per line: `lineTotal = quantity × unitPrice`.
  2. `subtotal = Σ lineTotal`.
  3. Apply quote-level discount to `subtotal` → `discountedSubtotal` (`PERCENT`: `subtotal × (1 − value/100)`; `FIXED`: `subtotal − value`, floored at 0).
  4. Per line, tax = `lineTotal`'s proportional share of `discountedSubtotal` × its `TaxRate.rate` (falls back to the org's default `TaxRate` if the line has none) — summed into `taxAmount`.
  5. `total = discountedSubtotal + taxAmount`.
  This logic lives once, in `features/quotes/calculations.ts` as `calculateQuoteTotal(items, discount)`, unit-tested directly (Section 40), and is the **only** place totals are computed — the builder calls a read-only preview version of the same function client-side for live display, and `createQuote`/`updateQuote` call the authoritative version server-side before writing.
- **Saving:** writes `Quote` + replaces all `QuoteItem` rows transactionally (delete-and-recreate is correct here, not an upsert merge — line items have no independent identity outside their quote, and the row count is small).

## 18. Line Item Architecture

- **Entity:** `QuoteItem { id, quoteId, serviceId?, description, quantity, unitPrice, lineTotal, taxRateId?, sortOrder }`.
- `serviceId = null` means an ad-hoc custom line — `description`/`unitPrice` are then fully free-form, not derived from a `Service`.
- `lineTotal` is stored (not computed on read) so historical quotes remain accurate even if a `Service`'s `price` changes later — this is why `Quote`/`QuoteItem` never join back to `Service.price` for display, only for the builder's "pre-fill" convenience at creation/edit time.
- `sortOrder` is a plain integer, re-sequenced (0, 1, 2, …) on every save — no gap-preserving logic needed at this row count.

## 19. Product & Service Catalog

- **Entities:** `ServiceCategory { id, organizationId, name, sortOrder, createdAt }`, `Service { id, organizationId, categoryId?, name, description?, sku?, unitType (HOUR/FLAT/UNIT/CUSTOM), price, isActive, createdAt, updatedAt }`, `TaxRate { id, organizationId, name, rate, isDefault, createdAt }`, `LeadSource { id, organizationId, name, costPerLead?, isActive, createdAt }`.
- **Ownership:** `OWNER` only for create/edit/deactivate; `STAFF` has read access (needed to use Services in the Quote Builder and to see Lead Sources on a Lead) but no write access. This is the one place Phase 5 introduces a write-permission tier narrower than "any non-FIELD" — justified because catalog data drives pricing org-wide and a mis-edit affects every future quote.
- **Deactivation, not deletion:** `Service.isActive = false` removes it from the Quote Builder's picker without breaking historical `QuoteItem.serviceId` references — consistent with the schema's no-soft-delete-but-also-no-destructive-edits posture for anything already referenced elsewhere.
- **Default TaxRate:** exactly one `TaxRate.isDefault = true` per organization, enforced in the action (`setDefaultTaxRate` atomically flips the old default off and the new one on in one transaction) — not a DB constraint, since Standard-tier Postgres enums/constraints were deliberately kept minimal per the frozen schema's own philosophy.
- **Caching:** Catalog data changes rarely and is read on every Quote Builder load — cached the same way `lib/config` caches `Organization.settings` (tag `catalog-${organizationId}`, invalidated on any Catalog write). This reuses the Phase 4 caching pattern rather than inventing a second one.

## 20. Job Management Architecture

- **Entity:** `Job { id, organizationId, quoteId (unique), customerId, assignedToId?, status, scheduledDate?, completedAt?, notes?, createdAt, updatedAt }`.
- **Creation:** never created directly by a user — created exactly once, automatically, inside `acceptQuote()` (Section 22), which is why there is no "New Job" button anywhere in the UI. `customerId` is copied from the Quote at creation time.
- **Scheduling:** `OWNER`/`STAFF` set `scheduledDate` and `assignedToId` (must be a `FIELD` user) from the Job detail page or the `/jobs/calendar` view (a simple calendar grid grouping Jobs by `scheduledDate`, reusing `<DataTable>`'s underlying query with a date-range filter rather than a new data-fetching mechanism).
- **FIELD access:** a `FIELD` user sees only Jobs where `assignedToId = session.userId`, can update `status` (`SCHEDULED → IN_PROGRESS → COMPLETED`) and append `completionNotes`/Activity/Notes from a mobile-optimized detail view, but cannot edit `scheduledDate`, `assignedToId`, or any financial field.
- **Completion:** transitioning to `COMPLETED` sets `completedAt`; does **not** auto-create an Invoice (Section 21) — invoicing is a deliberate, separate action, since a Job may need a deposit invoice raised before completion and a final invoice after.

## 21. Invoice Workflow

- **Entities:** `Invoice { id, organizationId, jobId, customerId, invoiceNumber, amount, paidAmount, status, dueDate?, issuedAt?, createdAt, updatedAt }`, `Payment { id, invoiceId, amount, method (CASH/CARD/BANK/OTHER), reference?, paidAt, createdAt }`.
- **Creation:** `OWNER`/`STAFF` create an Invoice from a Job at any point in the Job's lifecycle (deposit before work starts, progress invoice mid-job, final invoice at/after completion) — this is exactly why `Invoice.jobId` is deliberately not unique. `invoiceNumber` assigned via `getNextInvoiceNumber(organizationId)` at creation, same pattern as Quote.
- **Recording payment:** `recordPayment(invoiceId, amount, method, reference?)` creates a `Payment` row, then recomputes `Invoice.paidAmount = Σ Payment.amount` and derives `status`:
  - `paidAmount === 0` → `UNPAID`
  - `0 < paidAmount < amount` → `PARTIAL`
  - `paidAmount >= amount` → `PAID`
  `status` is **never** set directly by a user action — it is always a derived side effect of `recordPayment`, which is the only place that writes it (mirrors the "one writer" discipline the Configuration Service already established for `Organization.settings`).
- **Overdue detection:** computed on read (`status != PAID AND dueDate < now()`), surfaced as a visual flag on the list/detail screens and in the Dashboard's AR widget — not a stored status value and not a push notification, since no scheduled-job runner exists yet (Section 4).

## 22. Status Lifecycle

| Entity | States | Valid transitions | Side effects |
|---|---|---|---|
| Lead | NEW, CONTACTED, QUOTED, WON, LOST | NEW→CONTACTED→QUOTED→WON; any of NEW/CONTACTED/QUOTED→LOST | →WON requires a linked Customer (Section 14); →LOST requires `lostReason`; both log Activity |
| Quote | DRAFT, SENT, VIEWED, ACCEPTED, DECLINED, EXPIRED | DRAFT→SENT; SENT→VIEWED; VIEWED→ACCEPTED/DECLINED; SENT→ACCEPTED/DECLINED (a customer can accept without a tracked open); any non-terminal→EXPIRED past `expiryDate` | →SENT sets `sentAt`; →VIEWED sets `viewedAt`; →ACCEPTED sets `acceptedAt`, sets `Lead.status = WON` if linked, **creates the Job** (Section 20), fires `quote_accepted` Notification; →DECLINED sets `declinedAt`, fires `quote_declined` Notification |
| Job | SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED | SCHEDULED→IN_PROGRESS→COMPLETED; SCHEDULED/IN_PROGRESS→CANCELLED | →COMPLETED sets `completedAt`; →CANCELLED requires a confirmation note (stored as an Activity entry, not a new column) |
| Invoice | UNPAID, PARTIAL, PAID | UNPAID→PARTIAL→PAID (derived only, Section 21) | each transition is a side effect of `recordPayment`, never a direct user action |

Every transition is implemented as a single conditional Prisma update — `WHERE id = ? AND status = <expected-current>` — so a stale client attempting an already-superseded transition gets a clean, typed "this record was changed by someone else" error instead of corrupting state (Section 5's concurrency principle).

## 23. Assignment Workflow

Two independent assignment surfaces, intentionally not unified into one generic "assignment" subsystem because their rules differ:

- **Lead assignment:** `assignedToId` → any `STAFF` user in the organization. Settable by `OWNER`/`STAFF`. Reassignable at any status.
- **Job assignment:** `assignedToId` → any `FIELD` user in the organization. Settable by `OWNER`/`STAFF` only — a `FIELD` user can never reassign their own Job. Both use the shared `<AssigneeSelect>` component (Section 13), parameterized by which role to filter the user list to.

## 24. Activity Integration

Every module's detail-page Overview tab includes `<ActivityTimeline entityType={EntityType.LEAD|QUOTE|JOB|CUSTOMER|INVOICE} entityId={id} />` unmodified from Phase 4. Phase 5's only responsibility is calling `logActivity()` at the right moments. Event taxonomy, extended from Phase 4's base set (`created`, `status_changed`, `assigned`, `note_added`) with Phase 5-specific types:

`quote_revised`, `quote_sent`, `quote_viewed`, `quote_accepted`, `quote_declined`, `job_scheduled`, `job_assigned`, `job_completed`, `job_cancelled`, `invoice_created`, `payment_recorded`. All additive strings on the existing free-text `type` column — no enum, no migration, consistent with Phase 4's own taxonomy approach.

## 25. Notification Integration

| Event | Recipient | Type |
|---|---|---|
| `lead_assigned` | new Lead assignee | NORMAL |
| `quote_viewed` | Quote's `assignedToId` (fallback: `createdById`) | NORMAL |
| `quote_accepted` | Quote's `assignedToId`/`createdById` | HIGH |
| `quote_declined` | Quote's `assignedToId`/`createdById` | NORMAL |
| `job_assigned` | new Job assignee (FIELD user) | NORMAL |
| `payment_recorded` | Invoice's related Job's `assignedToId`-adjacent OWNER/STAFF who created the Invoice | LOW |

Every entry uses the Phase 4 `Notification` model's existing `entityType`/`entityId`/`actionUrl` fields to deep-link into the relevant record — no schema change.

## 26. Search Integration

Extends the Phase 4 ranked global search (currently Lead `name`/`phone`/`email` and Customer `name`/`phone`/`email`) with:

- `Quote.quoteNumber` (exact/prefix match ranks highest — a quote number is usually typed precisely).
- `Job` — searched by its linked `Customer.name` (Jobs have no name of their own).
- `Invoice.invoiceNumber`.

Each is a new adapter registered in `features/search/`'s existing ranked-aggregation function, following the same three-tier rank (exact → prefix → contains) and the same `requireCompanyScope()` org-scoping already in place — no change to the ranking algorithm itself.

## 27. File Attachment Strategy

Unchanged from Phase 4: no file storage provider exists yet (Vercel Blob deferred). Phase 5 introduces no attachment UI. If a future client needs to attach a signed PDF or a job-site photo, it lands on the existing `FileRef`/URL-paste contract (Phase 4 Section 3.2) the same way `Organization.logoUrl` already does — a pasted URL field, not an upload, until real storage is funded.

## 28. Validation Standards

One Zod schema per server action input, colocated in each module's `schema.ts`, shared between the client form and the server action (unchanged convention from Phase 4). New patterns specific to Phase 5:

- **Conditional requirement:** `lostReasonSchema` requires `lostReason` only when the submitted `status === "LOST"` (Zod `.superRefine`), not a separate endpoint.
- **Money fields:** parsed as strings from form input, validated as a decimal-string pattern, converted to Prisma `Decimal` server-side — never parsed as JS `number` at any point, to avoid float precision entering the pipeline at all.
- **Status transition inputs:** the action's schema validates only the *target* status is one of the enum's values; the *legality* of the specific current→target transition (Section 22) is business logic, not a Zod concern, and is checked in the action body before the conditional update.

## 29. Permission Model

| Action | OWNER | STAFF | FIELD |
|---|---|---|---|
| View/create/edit Leads, Customers | ✅ | ✅ | ❌ |
| View/create/edit/send/accept/decline Quotes | ✅ | ✅ | ❌ |
| Create/edit Catalog (Service/Category/TaxRate/LeadSource) | ✅ | ❌ (read-only) | ❌ |
| View Jobs | ✅ | ✅ (all) | ✅ (assigned only) |
| Schedule/assign Jobs | ✅ | ✅ | ❌ |
| Update assigned Job status/notes | ✅ | ✅ | ✅ (own jobs only) |
| Create/view Invoices, record Payments | ✅ | ✅ | ❌ |
| View Reports — operational tabs | ✅ | ✅ | ❌ |
| View Reports — revenue/financial tabs | ✅ | ❌ | ❌ |

Implemented entirely with the existing `requireRole(allowedRoles[])` helper at the top of each action/query — no new permission primitive. FIELD's "own jobs only" scoping is the one place a query adds an extra `AND assignedToId = session.userId` clause beyond `requireCompanyScope()`'s organization filter, documented per-query rather than hidden in a generic helper, since it's the only entity with this extra tier.

## 30. Server Action Standards

Unchanged shape from Phase 4, restated for the new modules' specific needs:

```ts
"use server";
export async function acceptQuote(quoteId: string) {
  const session = await requireSession();
  await requireActiveUser();
  const { organizationId } = await requireCompanyScope();

  const quote = await db.quote.update({
    where: { id: quoteId, organizationId, status: { in: ["SENT", "VIEWED"] } },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  }); // throws P2025 if the conditional WHERE didn't match — caught below as a stale-transition error

  const job = await db.job.create({
    data: { organizationId, quoteId, customerId: quote.customerId, status: "SCHEDULED" },
  });

  if (quote.leadId) {
    await db.lead.update({ where: { id: quote.leadId }, data: { status: "WON" } });
  }

  await logActivity({ entityType: "QUOTE", entityId: quote.id, type: "quote_accepted", createdById: session.userId });
  await createNotification({ /* see Section 25 */ });
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/jobs");
  return job;
}
```

Every action: auth check → scope check → role check (where needed) → Zod parse (for actions with user input) → the conditional write → side effects (Activity/Notification) → `revalidatePath` → typed return. Multi-step actions (like the above) run inside a single `db.$transaction()` in the real implementation — shown unwrapped here only for readability.

## 31. Data Table Standards

All six new list screens use the Phase 4 `<DataTable>` contract unmodified: server-side pagination (offset-based, page size 25 — cursor pagination is unnecessary overhead at Standard-tier row counts, a documented future upgrade if a client's data outgrows it), column-level sorting, and a filter bar driven by each entity's indexed columns (`status`, `assignedToId`, `sourceId`/`categoryId` where applicable) — chosen specifically because they're indexed (Section 37), so every filter combination stays a single fast query.

## 32. Export Integration

Each module registers a CSV exporter against the existing `Exporter` interface: `leads.csv`, `customers.csv`, `quotes.csv`, `jobs.csv`, `invoices.csv`. Each exporter is a thin mapping from the entity's query result to flat rows — no new export mechanism, no new file format, consistent with Phase 4's deliberate "only CSV is implemented" scope.

## 33. Dashboard Integration

Implements the Portfolio Blueprint's dashboard spec against real data for the first time:

- **KPI row:** New Leads (7d) — `COUNT(Lead) WHERE createdAt > now()-7d`; Quote Conversion Rate — `COUNT(Quote WHERE status=ACCEPTED) / COUNT(Quote WHERE status NOT IN (DRAFT))`; Avg. Quote Turnaround — `AVG(acceptedAt − sentAt)`; Revenue in Pipeline — `SUM(Quote.total) WHERE status IN (SENT, VIEWED)`; Jobs Scheduled This Week — `COUNT(Job) WHERE scheduledDate BETWEEN <this week>`.
- **Pipeline kanban:** Lead grouped by status (NEW/CONTACTED/QUOTED), read-only card view, click-through to Lead detail — not a drag-and-drop status editor in this phase (drag-and-drop status change is a documented future enhancement, Section 42).
- **Lead-source performance:** `LeadSource` joined to its Leads' conversion rate and `costPerLead`, rendered with Recharts (already in the stack).
- **Recent activity feed:** a new `getRecentActivityForOrganization(organizationId, limit)` query — the one Activity query Phase 4 didn't need, since Phase 4 had no entities to show activity *across*. This is the single new query this phase adds to the Activity module, and it's additive (no change to the existing per-entity query).

## 34. Reports Architecture

First-tier reports, each a single aggregate query (no pre-computed summary tables, per the frozen database document's own Section 6 guidance):

| Report | Query basis | Visibility |
|---|---|---|
| Quote turnaround time | `Quote.sentAt → acceptedAt` delta, averaged, filterable by date range | OWNER, STAFF |
| Loss pattern | `GROUP BY lostReason` on `Lead WHERE status = LOST` | OWNER, STAFF |
| Lead-source ROI | `LeadSource.costPerLead` vs. its Leads' conversion + resulting `Quote.total` sum | OWNER, STAFF |
| Revenue / AR | `SUM(Invoice.amount − Invoice.paidAmount) WHERE status != PAID` | **OWNER only** — the one financial report gated above STAFF (Section 29) |

## 35. Business Rules

Explicit decisions an implementer would otherwise have to invent:

1. **Quote revision numbering (gap, resolved without migration):** revisions get a new `quoteNumber` from the existing sequence rather than a suffix (e.g. `Q-1042-v2`) — no schema change needed, since `quoteNumber` is just a `String`. The revision relationship is fully recoverable via `parentQuoteId` alone.
2. **Customer-facing share link (gap, resolved without migration):** the public quote view needs an unguessable token. Rather than adding a new column, the implementation derives a signed token from `Quote.id` + a server-side secret (HMAC), verified on each public request — zero schema change, no new table, consistent with "frozen schema as a hard constraint."
3. A Lead can only reach `WON` with a linked `Customer` (Section 14).
4. A Quote can only be revised from a non-`ACCEPTED` status; `ACCEPTED` is final and immutable.
5. A Job is created exactly once per `ACCEPTED` Quote, automatically — there is no manual "create Job" path.
6. Invoice `status` is always derived from `Payment` sum, never set directly.
7. Catalog write access is `OWNER`-only; every other module's write access is `OWNER`/`STAFF` except where explicitly narrowed (FIELD's Job-only, assigned-only access).

## 36. Error Handling

Every server action returns a discriminated `ActionResult<T> = { success: true; data: T } | { success: false; error: string }` (extends, doesn't replace, Phase 4's existing error convention) so the client never needs a try/catch around a server action call — only a check on `.success`. Prisma's `P2025` (record not found / conditional update didn't match) is caught and mapped to a user-facing "This record was changed by someone else — refresh and try again" message, specifically for the status-transition actions in Section 22. All errors are logged server-side via the existing `lib/logger.ts` before being mapped to a safe client-facing string — no raw Prisma error ever reaches the client.

## 37. Performance Strategy

Every new query filters through `requireCompanyScope()` and an indexed column first (`status`, `assignedToId`, the various foreign keys already indexed in the frozen schema — Section 2 of the database document) — no new index is needed for anything in this phase. List screens never `include` more than one level of relation (e.g., the Quotes list shows `Customer.name` via a single join, not nested Job/Invoice data) — deeper data is fetched lazily on the detail page only. Dashboard/Reports aggregate queries run as single `groupBy`/aggregate statements, not N+1 loops over fetched rows.

## 38. Caching Strategy

Only Catalog data is cached (Section 19) — everything else (Lead/Quote/Job/Customer/Invoice lists and detail pages) is read live on every request, consistent with Phase 4's absolute rule that "authorization and session reads are never cached," extended here to mean **transactional business data is never cached either** in this phase — it changes too often and is read by too few concurrent users at Standard-tier scale to need it. This can be revisited if a real client's usage pattern proves otherwise (documented future option, Section 42), not assumed now.

## 39. Security Review

- **Tenant isolation:** every query in every new module passes through `requireCompanyScope()`; there is no query in this phase that fetches a record by ID alone without also filtering on `organizationId` — closing the IDOR class of bug at the query level, not via a post-fetch check.
- **Role enforcement is server-side only:** nav-item hiding (Section 10) is a UX convenience; every action independently calls `requireRole()` — a `FIELD` user crafting a direct request to a STAFF-only action is rejected by the action itself, not just kept from seeing the button.
- **Public quote link (Section 35, gap #2):** the HMAC token grants read + accept/decline access to exactly one Quote, never enumerable, never reusable to access any other record — explicitly not a session and not a backdoor into the authenticated app.
- **Money integrity:** totals are recomputed server-side on every save (Section 17); a manipulated client payload claiming a different `total` is simply ignored, since the server never trusts a client-submitted total.
- **Status transition races:** the conditional-update pattern (Section 22) is the primary defense against two users double-accepting the same Quote or double-recording a duplicate payment race; this is treated as a correctness requirement, not an edge case.

## 40. Testing Strategy

| Layer | Tool | Phase 5 coverage |
|---|---|---|
| Unit | Vitest | `calculateQuoteTotal()` (line items + discount + tax, including rounding); Lead/Quote/Job/Invoice status-transition validators (every illegal transition rejected); Invoice status derivation from a `Payment` sum |
| Integration | Vitest + Prisma test DB | "Accepting a Quote creates exactly one Job and flips the linked Lead to WON"; "Recording a Payment that completes the balance flips Invoice to PAID"; "A second concurrent accept on the same Quote fails cleanly" |
| Component | React Testing Library | Quote Builder line-item add/remove/reorder; conditional `lostReason` field; `<StatusTransitionMenu>` only rendering legal transitions |
| E2E | Playwright | Full pipeline: register → capture Lead → build & send Quote → customer accepts via public link → Job appears scheduled → complete Job → raise Invoice → record Payment → Invoice shows PAID |

This extends, rather than replaces, the Phase 4 testing table — the E2E flow above is the literal "lead → quote → job" flow that table already named as a placeholder; Phase 5 is what makes it real.

## 41. Risks

| Risk | Mitigation |
|---|---|
| Quote revision chain UI complexity (showing v1/v2/v3 clearly) | Scoped narrowly in Section 16 — a simple chain walk, no generic "version control" abstraction |
| Decimal precision drift if any code path uses `number` instead of `Decimal` | Stated as a hard rule (Section 5) and directly tested (Section 40); code review checks for any `parseFloat`/`Number()` near money fields |
| Status-transition race conditions under concurrent users | Conditional updates everywhere (Section 22), explicitly tested (Section 40) |
| Public quote link becoming a security surface if implemented carelessly | Constrained explicitly in Section 39 — single-purpose token, no session escalation path |
| Reports growing slow as data scales past Standard-tier assumptions | Explicitly deferred — pre-computed summary tables are a documented future option (Section 42), not built speculatively now |

## 42. Future Extension Points

- Bulk row actions (multi-select bulk status change, bulk export) on every `<DataTable>` — the table contract already supports row selection; only the bulk-action menu and corresponding batched server actions are net-new.
- Drag-and-drop Kanban status changes on the Dashboard pipeline view (currently read-only, Section 33).
- Recurring/templated Jobs for maintenance-contract style work.
- Pre-computed reporting summary tables, if a client's data volume ever makes the live aggregate queries in Section 34 too slow.
- Scheduled-job-driven reminders (invoice overdue, quote expiring soon) once a cron runner and Resend are both funded.
- Promoting the public quote link's HMAC token to a stored, revocable token if a client ever needs to invalidate a sent quote's link independent of its status.
- `ServiceCategory` nesting, `PriceList`, `CustomerContact`, scoped-rep visibility — all already identified as deferred by earlier phases; nothing in Phase 5 forecloses any of them.

## 43. Definition of Done

- [ ] Every module in Section 7 is implemented exactly as specified, with no business-entity field added, renamed, or removed beyond Section 35's two logged, migration-free gaps.
- [ ] Every status transition in Section 22 is implemented as a conditional update; every illegal transition is rejected and tested.
- [ ] Every permission row in Section 29 is enforced server-side and covered by at least one test asserting the denial.
- [ ] Activity, Notifications, Search, Export, and DataTable are extended per Sections 24–26 and 31–32 with zero duplication of Phase 4 logic.
- [ ] Money is `Decimal` end-to-end; no `number`/`Float` touches a money value anywhere in the diff.
- [ ] The full E2E flow in Section 40 passes.
- [ ] All gates pass: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- [ ] This document's status line is updated to **"Phase 5 — Frozen v1.0, completed [date]."**

## 44. Step-by-Step Implementation Roadmap

### Step 1 — Catalog & Reference Data
- **Objective:** `ServiceCategory`, `Service`, `TaxRate`, `LeadSource` CRUD (OWNER-write, STAFF-read), per Section 19.
- **Prerequisites:** none beyond Phase 4.
- **Deliverables:** `features/catalog/*`, catalog caching (tag `catalog-${organizationId}`).
- **Verification:** unit tests for default-`TaxRate` exclusivity; manual QA at all 3 roles.
- **Completion criteria:** PR merged; no other module yet depends on this code, so it can ship and freeze independently.

### Step 2 — Customer Module
- **Objective:** Customer CRUD, lifetime-value computed read, per Section 15.
- **Prerequisites:** Step 1 (none strictly, but ordered first since Leads/Quotes both need Customers to exist).
- **Deliverables:** `features/customers/*`.
- **Verification:** integration test for lifetime-value aggregate query correctness.
- **Completion criteria:** PR merged.

### Step 3 — Lead Module
- **Objective:** Lead CRUD, status lifecycle, assignment, loss tracking, per Section 14.
- **Prerequisites:** Steps 1 (LeadSource), 2 (Customer linking).
- **Deliverables:** `features/leads/*`.
- **Verification:** status-transition unit tests; `lostReason`-required-on-LOST test.
- **Completion criteria:** PR merged.

### Step 4 — Quote Module Data Layer & Calculations
- **Objective:** `Quote`/`QuoteItem` CRUD (DRAFT only), `calculateQuoteTotal()`, numbering integration, per Sections 16–18.
- **Prerequisites:** Steps 1–3.
- **Deliverables:** `features/quotes/{actions,queries,schema,calculations}.ts`.
- **Verification:** unit tests for calculation order (discount before tax, per-line tax proportionality, rounding).
- **Completion criteria:** PR merged; a Quote can be created and saved as DRAFT, no send/accept yet.

### Step 5 — Quote Builder UI
- **Objective:** Client-side builder (`features/quote-builder/`) wired to Step 4's actions.
- **Prerequisites:** Step 4.
- **Deliverables:** add/remove/reorder line items, catalog picker, discount input, live preview total.
- **Verification:** component tests for add/remove/reorder and live-total accuracy against the same `calculateQuoteTotal()`.
- **Completion criteria:** PR merged; `/quotes/new` and `/quotes/[id]/edit` fully functional for DRAFT quotes.

### Step 6 — Quote Lifecycle (Send/View/Accept/Decline) & Job Auto-Creation
- **Objective:** `sendQuote`, public token-based view route, `acceptQuote`/`declineQuote`, automatic Job creation, Lead→WON side effect, per Sections 16, 20, 22, 35 (gap #2).
- **Prerequisites:** Step 4.
- **Deliverables:** public `/q/[token]` route; conditional-update transitions; HMAC token signing utility.
- **Verification:** the concurrent-double-accept integration test (Section 40); token-forgery rejection test.
- **Completion criteria:** PR merged; this is the single highest-risk step and gates everything downstream of Job.

### Step 7 — Job Module
- **Objective:** Job list/detail/scheduling/assignment/status lifecycle, FIELD-scoped access, per Sections 20, 23.
- **Prerequisites:** Step 6 (Jobs only come from accepted Quotes).
- **Deliverables:** `features/jobs/*`, `/jobs/calendar`.
- **Verification:** FIELD-scoping test (a FIELD user cannot see/query another technician's Job); status-transition tests.
- **Completion criteria:** PR merged.

### Step 8 — Invoice & Payment Module
- **Objective:** Invoice creation off a Job, `recordPayment`, derived status, per Section 21.
- **Prerequisites:** Step 7.
- **Deliverables:** `features/invoices/*`.
- **Verification:** the PARTIAL/PAID derivation integration test (Section 40).
- **Completion criteria:** PR merged.

### Step 9 — Cross-Cutting Integration Pass (Activity / Notifications / Search / Export)
- **Objective:** Wire the event taxonomy (Section 24), notification table (Section 25), search adapters (Section 26), and CSV exporters (Section 32) across all six modules built in Steps 1–8.
- **Prerequisites:** Steps 1–8.
- **Deliverables:** updated `logActivity()` call sites; `createNotification()` call sites; `features/search/` and `features/export/` adapter registrations.
- **Verification:** one integration test per new event type confirming it fires exactly once at the right transition.
- **Completion criteria:** PR merged; no module's core CRUD logic changes in this step, only the glue around it.

### Step 10 — Dashboard
- **Objective:** KPI row, pipeline kanban, lead-source chart, recent activity feed, per Section 33.
- **Prerequisites:** Step 9 (needs real data flowing through every module to be meaningful).
- **Deliverables:** `features/dashboard/*`, `getRecentActivityForOrganization()`.
- **Verification:** manual QA against seeded data covering every KPI's edge case (zero leads, zero quotes sent, etc.).
- **Completion criteria:** PR merged.

### Step 11 — Reports
- **Objective:** Quote turnaround, loss pattern, lead-source ROI, revenue/AR, per Section 34, with the OWNER-only gate on the revenue tab.
- **Prerequisites:** Step 9.
- **Deliverables:** `features/reports/*`.
- **Verification:** role-gate test confirming STAFF cannot reach the revenue tab via direct route access.
- **Completion criteria:** PR merged.

### Step 12 — Full-Pipeline E2E & Definition of Done Verification
- **Objective:** The complete Playwright flow in Section 40; final pass against every Definition of Done item in Section 43.
- **Prerequisites:** Steps 1–11.
- **Deliverables:** E2E test suite; this document's status line updated to Frozen v1.0.
- **Verification:** full CI run (lint/typecheck/test/build) green; manual QA checklist (all roles, 0/1/50+ records, invalid input, mobile FIELD view) per the existing Phase 4-era checklist, extended to every new screen.
- **Completion criteria:** Phase 5 sign-off; Phase 6 planning may begin.
