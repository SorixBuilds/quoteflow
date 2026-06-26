# QuoteFlow — Standard Package Database Architecture
### Final, Prisma-Ready Schema for the Reusable Internal Tools Template

> **Scope:** This schema is built for the **Standard Package** offering ($2K–$10K, 5–30 employee clients, 3–4 roles, no integrations, no multi-location, no enterprise RBAC) and is meant to be cloned per client. It is deliberately *not* the most "complete" possible schema — it is the most complete schema that doesn't cost you build time or maintenance burden you don't need yet. Every cut item has a documented, zero-rework upgrade path.

---

## 1. Entity List (Simplified)

**Core Tenancy & Auth**
1. Organization
2. User

**Customer Module**
3. Customer

**Services / Catalog Module**
4. ServiceCategory
5. Service
6. TaxRate

**Leads & Pipeline Module**
7. LeadSource
8. Lead

**Quotes Module**
9. Quote
10. QuoteItem

**Jobs & Billing Module**
11. Job
12. Invoice
13. Payment

**Cross-Cutting**
14. Activity
15. Note
16. Task

**16 entities total** — down from the 24-entity enterprise-ready draft. Everything cut is listed explicitly in Section 9 with the reason and the upgrade path.

---

## 2. Full Schema Design

### Organization
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| name | String | |
| slug | String | unique |
| logoUrl | String, nullable | pasted URL, no file upload needed |
| timezone | String | |
| currency | String | ISO 4217 |
| settings | Json | terminology/branding overrides |
| createdAt, updatedAt | Timestamp | |

- **Indexes:** unique(slug)

### User
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| organizationId | UUID (FK → Organization) | |
| name | String | |
| email | String | |
| passwordHash | String, nullable | |
| role | Enum: `OWNER` / `STAFF` / `FIELD` | see Section 4 rationale |
| isActive | Boolean | |
| lastLoginAt | Timestamp, nullable | |
| createdAt, updatedAt | Timestamp | |

- **Indexes:** organizationId; **unique(organizationId, email)** — scoped, not global, so two client orgs can each onboard the same person's email independently
- **App-layer constraint:** at least one `OWNER` must always exist per organization

### Customer
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| organizationId | UUID (FK) | |
| name | String | |
| type | Enum: `INDIVIDUAL` / `BUSINESS` | |
| email, phone | String, nullable | |
| address | Json, nullable | single field, not split billing/shipping — Standard tier doesn't need that distinction |
| createdAt, updatedAt | Timestamp | |

- **Indexes:** organizationId; (organizationId, email)
- *No separate CustomerContact table* — see Section 9

### ServiceCategory
| Field | Type |
|---|---|
| id | UUID (PK) |
| organizationId | UUID (FK) |
| name | String |
| sortOrder | Int |
| createdAt | Timestamp |

- **Flat, no self-reference.** Nested category trees are catalog-platform behavior, not a 10–20-service SMB need.
- **Indexes:** organizationId

### Service
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| organizationId | UUID (FK) | |
| categoryId | UUID (FK), nullable | |
| name | String | |
| description | String, nullable | |
| sku | String, nullable | |
| unitType | Enum: `HOUR` / `FLAT` / `UNIT` / `CUSTOM` | |
| price | Decimal(10,2) | |
| isActive | Boolean | |
| createdAt, updatedAt | Timestamp | |

- **Indexes:** (organizationId, isActive); unique(organizationId, sku)
- No per-service `defaultTaxRateId` — Standard tier uses one org-level default `TaxRate`, overridable per `QuoteItem` if needed. Saves a column with no real loss of capability.

### TaxRate
| Field | Type |
|---|---|
| id | UUID (PK) |
| organizationId | UUID (FK) |
| name | String |
| rate | Decimal(5,2) |
| isDefault | Boolean |
| createdAt | Timestamp |

- **Indexes:** organizationId

### LeadSource
| Field | Type |
|---|---|
| id | UUID (PK) |
| organizationId | UUID (FK) |
| name | String |
| costPerLead | Decimal(10,2), nullable |
| isActive | Boolean |
| createdAt | Timestamp |

### Lead
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| organizationId | UUID (FK) | |
| name | String | |
| email | String, nullable | |
| phone | String | |
| sourceId | UUID (FK), nullable | |
| status | Enum: `NEW`/`CONTACTED`/`QUOTED`/`WON`/`LOST` | |
| **lostReason** | String, nullable | **restored — free column, drives loss-pattern reporting** |
| assignedToId | UUID (FK → User), nullable | |
| customerId | UUID (FK), nullable | |
| createdAt, updatedAt | Timestamp | |

- **Indexes:** (organizationId, status); assignedToId

### Quote
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| organizationId | UUID (FK) | |
| quoteNumber | String | sequential, human-facing |
| leadId | UUID (FK), nullable | |
| customerId | UUID (FK) | required |
| status | Enum: `DRAFT`/`SENT`/`VIEWED`/`ACCEPTED`/`DECLINED`/`EXPIRED` | |
| version | Int, default 1 | |
| parentQuoteId | UUID (self-FK), nullable | revision chain — no separate snapshot table needed |
| discountType | Enum: `PERCENT`/`FIXED`, nullable | restored — 2 cheap columns, removes real ambiguity vs. a flat "discount" number |
| discountValue | Decimal(10,2), nullable | |
| subtotal, taxAmount, total | Decimal(10,2) | always recomputed server-side |
| currency | String | |
| issueDate, expiryDate | Timestamp, nullable | |
| sentAt, viewedAt, acceptedAt, declinedAt | Timestamp, nullable | drives status-progression UI directly |
| createdById, assignedToId | UUID (FK → User) | |
| notes, terms | Text, nullable | |
| createdAt, updatedAt | Timestamp | |

- **Indexes:** (organizationId, status); unique(organizationId, quoteNumber)

### QuoteItem
| Field | Type |
|---|---|
| id | UUID (PK) |
| quoteId | UUID (FK) |
| serviceId | UUID (FK), nullable — null = ad-hoc custom line |
| description | String |
| quantity, unitPrice, lineTotal | Decimal(10,2) |
| taxRateId | UUID (FK), nullable |
| sortOrder | Int |

- **Indexes:** quoteId

### Job
| Field | Type |
|---|---|
| id | UUID (PK) |
| organizationId | UUID (FK) |
| quoteId | UUID (FK), **unique** — one job per accepted quote |
| customerId | UUID (FK) |
| assignedToId | UUID (FK → User), nullable |
| status | Enum: `SCHEDULED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED` |
| scheduledDate, completedAt | Timestamp, nullable |
| notes | Text, nullable |
| createdAt, updatedAt | Timestamp |

- **Indexes:** (organizationId, status); assignedToId

### Invoice
| Field | Type | Notes |
|---|---|---|
| id | UUID (PK) | |
| organizationId | UUID (FK) | |
| jobId | UUID (FK) — **not unique** | **kept 1-to-many on purpose — see Section 9** |
| customerId | UUID (FK) | |
| invoiceNumber | String | |
| amount, paidAmount | Decimal(10,2) | |
| status | Enum: `UNPAID`/`PARTIAL`/`PAID` | |
| dueDate, issuedAt | Timestamp, nullable | |
| createdAt, updatedAt | Timestamp | |

- **Indexes:** (organizationId, status); jobId; unique(organizationId, invoiceNumber)

### Payment
| Field | Type |
|---|---|
| id | UUID (PK) |
| invoiceId | UUID (FK) |
| amount | Decimal(10,2) |
| method | Enum: `CASH`/`CARD`/`BANK`/`OTHER` |
| reference | String, nullable |
| paidAt | Timestamp |
| createdAt | Timestamp |

- **Indexes:** invoiceId

### Activity *(polymorphic — see Section 8 for the honest trade-off)*
| Field | Type |
|---|---|
| id | UUID (PK) |
| organizationId | UUID (FK) |
| entityType | Enum: `LEAD`/`QUOTE`/`JOB`/`CUSTOMER`/`INVOICE` |
| entityId | UUID — not DB-enforced as a real FK |
| type | String |
| message | String, nullable |
| createdById | UUID (FK → User) |
| createdAt | Timestamp |

- **Indexes:** (organizationId, entityType, entityId)

### Note *(same polymorphic shape)*
| Field | Type |
|---|---|
| id | UUID (PK) |
| organizationId | UUID (FK) |
| entityType | Enum (same set) |
| entityId | UUID |
| content | Text |
| createdById | UUID (FK) |
| createdAt | Timestamp |

### Task
| Field | Type |
|---|---|
| id | UUID (PK) |
| organizationId | UUID (FK) |
| entityType | Enum, nullable — general tasks allowed |
| entityId | UUID, nullable |
| title | String |
| dueDate | Timestamp, nullable |
| status | Enum: `OPEN`/`DONE` |
| assignedToId | UUID (FK → User) |
| createdById | UUID (FK) |
| createdAt | Timestamp |

**No AuditLog table in Standard core.** See Section 9.

---

## 3. Relationships Diagram (text)

```
Organization
 ├─ 1───* User
 ├─ 1───* Customer
 ├─ 1───* ServiceCategory
 │         └─ 1───* Service ───*── 1 TaxRate (shared, optional override)
 ├─ 1───* LeadSource
 ├─ 1───* Lead ──(0/1)── Customer
 │         └─ 1───* Quote
 ├─ 1───* Quote
 │         ├─ 1───* QuoteItem ──(0/1)── Service
 │         ├─ self: parentQuoteId → revision chain (no snapshot table)
 │         └─ 1───1 Job   (created only when status = ACCEPTED)
 ├─ 1───* Job
 │         └─ 1───* Invoice        ← intentionally 1-to-many (deposit/progress/final)
 │                   └─ 1───* Payment
 └─ (cross-cutting, *—1 Organization, *—1 [Lead|Quote|Job|Customer|Invoice]):
       Activity, Note, Task
```

**Core flow:** `Lead → Quote → Job → Invoice → Payment`, exactly as your existing product already validates — this schema is an evolution of it, not a replacement.

---

## 4. Multi-Tenancy Model

**Approach:** row-level isolation. Every tenant-owned table carries `organizationId` directly (even tables like `QuoteItem` and `Payment` that are technically reachable via a join) so every query is a single indexed `WHERE organizationId = $1` with no join required.

**An honest note on why this matters less than it sounds, for *this* package specifically:** your actual delivery model is one deployed instance per client, not one shared database serving many clients at once. In that reality, most deployed instances will only ever contain a single `Organization` row — the tenancy scoping is "insurance," not a today-requirement. It's worth keeping anyway for three reasons:
1. **Zero extra cost.** It's the exact same column you'd add regardless, since you're cloning this codebase per client.
2. **It's what makes cloning safe.** If you ever reuse seed/demo data structures or accidentally point two environments at one database during testing, tenant scoping is the guardrail that stops data bleeding across clients.
3. **It's the one decision that's expensive to add later** if you ever do pursue a hosted multi-tenant version of this product instead of bespoke-per-client builds.

**Why row-level over schema-per-tenant:** schema-per-tenant means re-running every migration once per client forever, and provisioning infrastructure per signup — both directly conflict with "fast to deploy, easy to clone."

---

## 5. Module Mapping

| Module | Entities |
|---|---|
| **CRM / Leads** | Lead, LeadSource, Customer |
| **Quotes** | Quote, QuoteItem, Service, ServiceCategory, TaxRate |
| **Jobs / Fulfillment** | Job |
| **Billing** | Invoice, Payment |
| **Reporting** | Reads across Lead, Quote, Job, Invoice — no dedicated tables, see Section 6 |
| **Dashboard / Activity feed** | Activity, Note, Task |
| **Auth / Org** | Organization, User |

---

## 6. Reporting & Analytics Design

No separate reporting tables exist at Standard tier — every report is a read-aggregation against operational tables, kept fast by the indexes already defined above:

- **Lead-source ROI:** `GROUP BY sourceId` on `Lead`, joined to `LeadSource.costPerLead`, against `status = WON` count and `Quote.total` for converted leads.
- **Conversion rate:** `COUNT(status = WON) / COUNT(*)` on `Lead`, filterable by date range via `createdAt`.
- **Quote turnaround time:** `Quote.sentAt` → `Quote.acceptedAt` delta, averaged.
- **Loss pattern report:** `GROUP BY lostReason` on `Lead WHERE status = LOST` — this is exactly why that column was restored.
- **Revenue/AR:** `SUM(Invoice.amount - Invoice.paidAmount) WHERE status != PAID`, scoped by `organizationId`.

All of these are single-table or single-join aggregate queries — no pre-computed summary tables needed until you're operating at a scale well beyond a 5–30 person client, which is explicitly out of scope here.

---

## 7. Export System Support (PDF/Docs)

`Quote` + `QuoteItem` *are* the export-ready data — there is no separate "Document" table. A PDF is generated on demand (e.g., via `@react-pdf/renderer`, your already-chosen zero-cost tool) directly from the Quote's current line items and totals at render time, never stored as a binary file. This avoids needing file storage (Vercel Blob) at this tier entirely, consistent with your existing zero-cost decision to defer it.

`Quote.sentAt` / `viewedAt` / `acceptedAt` / `declinedAt` give you the full status-progression UI (sent → viewed → accepted) without any additional tracking table.

---

## 8. Final Prisma Readiness Check

| Concern | Handling |
|---|---|
| **Polymorphic Activity/Note/Task** | Real limitation, accepted deliberately. `entityId` cannot be a real Prisma-enforced FK. This is *not* "fixed" by anything in this schema — it's the correct trade-off at this scope because the alternative (5 separate tables per entity type) is the over-normalization the brief explicitly says to avoid. Application code must be tested carefully here; the database will not catch a bad reference. |
| **Decimal fields** | Must use Prisma's `Decimal` type everywhere money appears — never `Float`. |
| **Enums** | `Role`, `LeadStatus`, `QuoteStatus`, `JobStatus`, `InvoiceStatus` are all stable, small, well-known lists — correct as Postgres enums at this tier. Adding a value requires a migration, which is fine; promoting any of them to a real table is only worth it once a client needs *custom* values, which is explicitly out of scope here. |
| **JSON usage** | Limited to `Organization.settings` and `Customer.address` — both legitimate (org-level config; a real semi-structured address), not a JSON-as-shortcut pattern. Validate shape with Zod at the boundary. |
| **Self-referencing Quote.parentQuoteId** | Needs an explicit named relation in Prisma to avoid ambiguity with the standard `Quote` relation. |
| **Soft deletes** | Not included in this Standard-tier schema (kept out deliberately — hard delete with a confirmation step is simpler and sufficient at this scope; soft-delete discipline is real overhead you don't need yet). |

---

## 9. Final Verdict

**Confidence score: 9/10**

This is the right schema for a $2K–$10K, 5–30 employee, no-integrations Standard Package, and it's tighter than both prior drafts — Claude's original (too enterprise-ready) and the proposed simplification you shared (cut some right things, cut a couple of free/valuable things, kept one thing — AuditLog — that's genuinely out of scope, and mislabeled the polymorphic-FK trade-off as solved when it wasn't).

**Risks:**
1. Polymorphic `entityId` on Activity/Note/Task has no DB-level integrity check — needs deliberate test coverage at the application layer, every time.
2. Row-level tenancy is only as strong as the discipline applying `organizationId` filters everywhere — worth a query-helper convention from day one of the actual build, not retrofitted later.
3. If a Standard client unexpectedly needs custom pipeline stages or custom roles mid-engagement, that's an explicit upsell conversation ("that's a Premium-tier feature, here's the scoped add-on cost") — not something to quietly absorb into this schema.

**What should NOT be added at this package level** (explicitly, so it doesn't creep back in):
- Role/Permission/RolePermission tables
- PriceList/PriceListItem
- CustomerContact (multiple stakeholders per customer)
- ServiceCategory nesting
- QuoteVersionSnapshot (full JSON history table)
- AuditLog (before/after diff table)
- Multi-organization User membership
- Any third-party integration fields (Stripe IDs, QuickBooks sync fields, etc.)

Every one of these has a documented, additive upgrade path — none of them require restructuring an existing table if a client later needs them at Premium/Enterprise tier.

**Final recommendation:** build this 16-entity schema in Prisma now. It is the smallest model that still fully supports the Standard Package's stated feature list (roles, conversion tracking + PDF export, dashboard/KPIs, reports, fulfillment tracking, lightweight field view) without inheriting complexity that belongs to a different pricing tier.
