# QuoteFlow Public API — v1 Reference

**Base path:** `/api/v1` · **Version:** v1 · **Auth:** API key (bearer)

This is the endpoint reference for QuoteFlow's versioned public API (§21 of the
Phase 6 architecture). v1 exposes **read** access to the five core business
resources, **write** access to leads, customers, and quotes, and **outbound
webhooks** for the platform's full event taxonomy. Changes to v1 are only ever
additive — nothing documented here will change shape (§21.14 versioning
policy).

---

## Authentication

Every request must carry an API key issued from **Settings → API Keys** (OWNER
only):

```
Authorization: Bearer qf_live_...
```

- Keys are stored hashed; the full key is shown **once** at creation. Losing it
  means rotating it.
- Each key carries an explicit **scope subset** chosen at creation
  (least-privilege, §21.8). Scopes cannot be edited afterwards — rotate the key
  to change them.
- Rotating a key mints a replacement with the same name/scopes and revokes the
  old key immediately.

**Scopes used by v1:** `leads:read`/`leads:write`, `quotes:read`/`quotes:write`,
`customers:read`/`customers:write`, `jobs:read`, `invoices:read`. (`jobs:write`
and `invoices:write` are defined but have no endpoints yet — jobs and invoices
are created by QuoteFlow's own workflow, from accepted quotes; `webhooks:manage`
is reserved — webhooks are managed in Settings → Integrations.)

## Rate limiting

100 requests per 60-second sliding window per key (§21.11). Exceeding it
returns `429` with a `Retry-After` header (seconds).

## Response envelopes

List endpoints:

```json
{ "data": [ ... ], "pagination": { "page": 1, "pageSize": 25, "total": 42 } }
```

Detail endpoints:

```json
{ "data": { ... } }
```

Errors (§21.10), always this shape:

```json
{ "error": { "code": "insufficient_scope", "message": "..." } }
```

| Status | Code | Meaning |
|---|---|---|
| 400 | `invalid_json` | Request body is not valid JSON |
| 401 | `missing_api_key` | No `Authorization: Bearer` header |
| 401 | `invalid_api_key` | Unknown or revoked key (indistinguishable by design) |
| 403 | `insufficient_scope` | Key lacks the endpoint's required scope |
| 404 | `not_found` | No such resource in your organization |
| 422 | `invalid_parameter` | Malformed query parameter (named in the message) |
| 422 | `validation_error` | Request body fails validation (first issue in the message) |
| 422 | `business_rule_violation` | Valid input rejected by a business rule (message explains) |
| 429 | `rate_limited` | Rate limit exceeded — honor `Retry-After` |
| 500 | `internal_error` | Unexpected server error |

Writes return `201 Created` with `{ "data": { "id": "..." } }` (PATCH returns
`200` with the updated resource).

## Data representation

- **Money and quantities** are fixed-2 decimal **strings** (`"1250.00"`), never
  floats — parse with a decimal type.
- **Dates** are ISO-8601 UTC strings or `null`.
- Unrecognized response fields must be ignored: new fields may be added to v1
  at any time (additive-only, §21.14).

## Pagination & filtering

All list endpoints accept `page` (default 1) and `pageSize` (default 25,
maximum 100). Filters are optional query parameters; an invalid filter value is
a `422`, never silently ignored.

---

## Endpoints

### Leads — scopes `leads:read`, `leads:write`

- `GET /api/v1/leads` — filters: `status`
  (`NEW | CONTACTED | QUOTED | WON | LOST`), `customerId` (UUID)
- `GET /api/v1/leads/{id}`
- `POST /api/v1/leads` — body: `{ name, phone, email?, sourceId?, assignedToId? }`.
  Created as `NEW`; `sourceId`/`assignedToId` must belong to your organization.
  Runs the exact same business logic as creating a lead in the app (Activity,
  assignee notification, `lead.created` event).

Fields: `id`, `name`, `email`, `phone`, `status`, `lostReason`, `sourceId`,
`assignedToId`, `customerId`, `createdAt`, `updatedAt`.

### Customers — scopes `customers:read`, `customers:write`

- `GET /api/v1/customers` — filters: `type` (`INDIVIDUAL | BUSINESS`)
- `GET /api/v1/customers/{id}`
- `POST /api/v1/customers` — body: `{ name, type, email?, phone?, address? }`
  where `address` is `{ street?, city?, state?, postal?, country? }`
- `PATCH /api/v1/customers/{id}` — same body shape (full update); returns the
  updated customer

Fields: `id`, `name`, `type`, `email`, `phone`, `address` (JSON), `createdAt`,
`updatedAt`.

### Quotes — scopes `quotes:read`, `quotes:write`

- `GET /api/v1/quotes` — filters: `status`
  (`DRAFT | SENT | VIEWED | ACCEPTED | DECLINED | EXPIRED`), `customerId` (UUID)
- `GET /api/v1/quotes/{id}` — includes `items[]`
- `POST /api/v1/quotes` — body: `{ customerId, items: [{ description, quantity,
  unitPrice, serviceId?, taxRateId? }], leadId?, discountType?, discountValue?,
  issueDate?, expiryDate?, notes?, terms? }`. Creates a `DRAFT`; the quote
  number is assigned atomically and **all totals are computed server-side from
  the items** — submitted amounts are never trusted. Same implementation as the
  in-app quote builder.

Fields: `id`, `quoteNumber`, `status`, `version`, `parentQuoteId`,
`customerId`, `leadId`, `discountType`, `discountValue`, `subtotal`,
`taxAmount`, `total`, `currency`, `issueDate`, `expiryDate`, `sentAt`,
`viewedAt`, `acceptedAt`, `declinedAt`, `createdAt`, `updatedAt`.
Item fields: `id`, `description`, `quantity`, `unitPrice`, `lineTotal`,
`serviceId`, `taxRateId`, `sortOrder`.

### Jobs — scope `jobs:read`

- `GET /api/v1/jobs` — filters: `status`
  (`SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED`), `customerId` (UUID)
- `GET /api/v1/jobs/{id}`

Fields: `id`, `quoteId`, `customerId`, `assignedToId`, `status`,
`scheduledDate`, `scheduledEndAt`, `completedAt`, `notes`, `createdAt`,
`updatedAt`.

### Invoices — scope `invoices:read`

- `GET /api/v1/invoices` — filters: `status` (`UNPAID | PARTIAL | PAID`),
  `customerId` (UUID)
- `GET /api/v1/invoices/{id}` — includes `payments[]`

Fields: `id`, `invoiceNumber`, `jobId`, `customerId`, `amount`, `paidAmount`,
`balance` (derived, floored at zero), `status`, `dueDate`, `issuedAt`,
`createdAt`, `updatedAt`.
Payment fields: `id`, `invoiceId`, `amount`, `method`, `reference`, `paidAt`.

---

## Example

```bash
curl -s "https://<your-deployment>/api/v1/quotes?status=ACCEPTED&page=1&pageSize=50" \
  -H "Authorization: Bearer qf_live_..."
```

```json
{
  "data": [
    {
      "id": "0b6c9c3e-...",
      "quoteNumber": "Q-0042",
      "status": "ACCEPTED",
      "total": "4850.00",
      "currency": "USD",
      "acceptedAt": "2026-06-28T15:04:11.000Z",
      "customerId": "7f1d2a90-...",
      "createdAt": "2026-06-20T09:12:44.000Z",
      "updatedAt": "2026-06-28T15:04:11.000Z"
    }
  ],
  "pagination": { "page": 1, "pageSize": 50, "total": 1 }
}
```

## Webhooks

Outbound webhooks push signed event notifications to your endpoint. They are
managed in **Settings → Integrations** (OWNER only): choose an **https** URL
and an explicit subset of events. The HMAC signing secret is shown **once** at
creation.

**Events:** `lead.created`, `lead.converted`, `quote.created`, `quote.sent`,
`quote.accepted`, `quote.declined`, `quote.revised`, `job.scheduled`,
`job.completed`, `invoice.created`, `invoice.sent`, `invoice.paid`,
`invoice.overdue`, `payment.recorded`, `customer.created`, `customer.updated`.

**Delivery.** For each event, QuoteFlow POSTs JSON to your URL:

```json
{
  "id": "<delivery-uuid>",
  "event": "quote.accepted",
  "occurredAt": "2026-07-02T15:04:11.000Z",
  "data": { "organizationId": "...", "quoteId": "..." }
}
```

Headers: `X-QuoteFlow-Event` (event name), `X-QuoteFlow-Delivery` (delivery id
— deduplicate on it; redeliveries are possible), and `X-QuoteFlow-Signature`.
The payload carries entity **ids**; fetch current state through the read API
(the id, not the payload, is the source of truth).

**Signature verification.** The header is `t=<unix-seconds>,v1=<hex>` where
`v1` is HMAC-SHA256 of `"<timestamp>.<rawBody>"` under your signing secret.
Recompute it over the raw request body, constant-time-compare, and reject
timestamps older than your tolerance (300 s recommended) to bound replay.

**Retries.** A non-2xx response or timeout (10 s) marks the delivery FAILED and
schedules a retry with exponential backoff (1 s base, 5 min cap), up to **5
attempts** total, after which the delivery is terminal. Delivery history is
visible per webhook in Settings → Integrations. Respond `2xx` quickly and do
your processing asynchronously.

## Security notes for integrators

- One key per integration; name keys after where they run.
- Store keys in your secret manager — QuoteFlow cannot re-display them.
- All ids are UUIDs scoped to your organization; an id from another tenant
  404s.
- Enum status values may gain new members over time; treat unknown values as
  opaque strings.
