# QuoteFlow — Phase 6B Step 4 Implementation Report

## Customer Portal

| | |
|---|---|
| **Milestone** | Phase 6B — Step 4 (Customer Portal) |
| **Status** | ✅ Complete & verified |
| **Date** | 2026-06-29 |
| **Source of truth** | `QuoteFlow_Phase6_Advanced_Platform_Architecture.md` §12 (Customer Portal), §10.6/§10.8 (documents), §22/§25 (auth planes) |
| **New dependencies** | **0** |
| **Schema changes** | **0** (model `PortalAccessToken` already shipped in Step 1) |

---

## 1. Executive Summary

Step 4 delivers the **Customer Portal** (§12): a fully isolated, customer-facing web surface where a `Customer` — with no internal QuoteFlow account — can view their own Quotes, accept/decline them, view Invoices with payment history, track Jobs, download branded PDFs, and update their own contact details. It is a **second authentication plane**, signed with the same `AUTH_SECRET` but with a distinct cookie, a disjoint claim shape (`{ customerId, organizationId }` — never a `userId`/`role`), and a CI-enforced import boundary so a portal request can never reach an internal-app authorization decision and vice-versa.

The portal reuses every existing service rather than reimplementing it: Accept/Decline call the **same** `acceptQuote()`/`declineQuote()` transitions the staff app and public share-link use; PDFs render through the **same** `renderDocument()` path; money is the same Decimal-correct `lib/money` serialization; contact validation reuses the internal Customer Zod schema; files reuse Step 3's `getAttachmentsForEntity`; currency comes from the canonical Configuration Service. No business logic, repository, calculation, or PDF generator was duplicated.

All four gates pass: **tsc 0 · eslint 0/0 · vitest 72 files / 416 tests · next build ✓**.

## 2. Objectives Completed

- Secure, stored, revocable, expirable token authentication (bcrypt-hashed; §12.9).
- Separate portal session cookie + `requirePortalSession()` plane (§12.6).
- Additive `/portal/*` route-classification bucket + middleware pass-through (§12.9).
- Customer dashboard (open quotes, active jobs, outstanding balance, recent records).
- Quote viewing + Accept/Decline reusing the frozen transitions (§12.8).
- Invoice center (balance, payment history, invoice & receipt PDF).
- Job tracking (status/schedule/completion timeline, read-only).
- File access (read-only, ownership-gated) integrating Step 3.
- Portal document downloads via the shared renderer (§10.6).
- Staff-side token issue/revoke UI on the Customer detail page.
- Comprehensive tests incl. the import-boundary and IDOR/isolation suites.

## 3. Portal Architecture

```
features/customer-portal/
  session.ts        # HMAC-signed portal cookie plane (sign/verify/require/set/clear)
  queries.ts        # customer-scoped reads (quotes/invoices/jobs/account/files/doc-ownership)
  actions.ts        # CUSTOMER plane: redeem/logout/accept/decline/contact-update
  staff-actions.ts  # STAFF plane: issue/revoke token (the only requireRole use)
  staff-queries.ts  # staff token list (hash-free view)
  repository.ts     # (Step 1) PortalAccessToken persistence
  token.ts          # (Step 1) token mint/verify
  validation.ts     # (Step 1 + Step 4) issuance + reused contact schema
  components/        # PortalNav, PortalLoginForm, PortalQuoteView, PortalInvoiceView,
                     # PortalJobTimeline, PortalContactForm, PortalFileList,
                     # QuoteDecisionButtons, PortalAccessPanel (+ staff forms)
app/(portal)/
  layout.tsx                         # separate route group, noindex
  portal/login/page.tsx              # token redemption (POST, not GET side-effect)
  portal/(app)/layout.tsx            # requirePortalSession + nav (guards authed subtree)
  portal/(app)/{page,quotes,invoices,jobs,account}/...
  portal/documents/[type]/[id]/route.ts  # portal-scoped PDF via shared renderDocument()
```

The `(app)` route group keeps URLs at `/portal/*` while letting `/portal/login` sit outside the nav-bearing, session-guarded layout.

## 4. Authentication

- **Issuance (staff):** `issuePortalToken()` (OWNER/STAFF) mints a 256-bit token, stores only its bcrypt hash, and returns a one-time `/portal/login?token=...` link shown exactly once.
- **Redemption (customer):** `/portal/login` prefills the token and POSTs to `redeemPortalSession()`, which bcrypt-compares against the redeemable candidate set, stamps `lastUsedAt`, and sets the signed portal cookie.
- **Session:** `signPortalSession`/`verifyPortalSession` — HMAC-SHA256 over a base64url JSON payload with `iat`/`exp`, constant-time compared, domain-separated by purpose `portal-session:v1`. Cookie `qf_portal_session`, `httpOnly`, `SameSite=Lax`, `Secure` in prod, **path-scoped to `/portal`** (a staff route never receives it), 30-day default lifetime.
- **Logout:** `logoutPortal()` clears the cookie and returns to login.

## 5. Dashboard

`/portal` shows the customer's name, three summary cards (open quotes, active jobs, outstanding balance computed by summing floored invoice balances), and the five most recent quotes/invoices/jobs as linked rows. There is intentionally **no internal Activity feed** — the Activity log carries staff attribution and internal notes; the "recent activity" surface is derived from the customer's own records instead (§12.8).

## 6. Quote Features

`PortalQuoteView` renders line items, totals, notes/terms (all server-formatted strings), a status badge, and a **Download PDF** link. `QuoteDecisionButtons` (shown only while `decidable`) call `acceptQuoteFromPortal`/`declineQuoteFromPortal`, which prove customer ownership + decidability under the portal scope, then delegate to the shared `acceptQuote()`/`declineQuote()` with the quote's own `createdById` as the system actor. The conditional-update concurrency guarantee is unchanged; accepting a quote creates the Job exactly as the staff/public flows do. Draft quotes are never visible.

## 7. Invoice Features

`PortalInvoiceView` shows Invoice Total / Amount Paid / Balance Due, the running payment history table, and **Download invoice** plus **Download receipt** (the latter only once a payment exists). Read-only — no "record a payment" control (online payment is explicitly out of scope until a payment integration exists, §12.13/§5).

## 8. Job Tracking

`PortalJobTimeline` renders a status badge, technician name, and a derived Scheduled → In progress → Completed milestone timeline from the job's own frozen fields, plus customer-safe notes. Read-only; no management control is exposed (§5). The internal Activity log is never surfaced.

## 9. File Integration

`getPortalEntityFiles()` proves the (entityType, entityId) belongs to the session customer, then reuses Step 3's `getAttachmentsForEntity`. `PortalFileList` is a read-only list with preview/download via the same plain stored-URL link the internal app uses (no server proxy, no SSRF surface). The portal never uploads, renames, or deletes.

## 10. Document Integration

`/portal/documents/[type]/[id]` re-derives `{ customerId, organizationId }` from the verified cookie, calls `portalOwnsDocument()` (a `WHERE id = ? AND organizationId = ? AND customerId = ?` check) **before** rendering, then streams the PDF through the **same** `renderDocument()` the staff route uses (§10.6 — one render path). Only customer-facing types are exposed (Quote/Invoice/Receipt); the internal Job Sheet/Work Order are denied (§12.5/§5). `Cache-Control: private, no-store`.

## 11. Notifications

The frozen `Notification` model is keyed to a `User` (staff); there is no customer-facing notification entity, and §12 specifies none. Portal notifications are therefore **deferred** (documented, not silently skipped) — the dashboard's recent-records roll-up covers the "what changed" need without a new system. When Email is funded (§12.13) it becomes the natural customer notification channel.

## 12. Security

- **Two isolated planes:** distinct cookie name, `/portal`-scoped path, disjoint claim shape; `requireSession()` and `requirePortalSession()` decode incompatible shapes — a leaked cookie can't cross over.
- **Import boundary (CI-enforced, §12.12/§25):** `session.ts`/`actions.ts`/`queries.ts` import no staff auth helper; `staff-actions.ts` is the single, intentional bridge; no `@/lib`/`features/auth` module imports `requirePortalSession`. Asserted by `import-boundary.test.ts`.
- **IDOR / tenant isolation:** every read/write is scoped by both `customerId` and `organizationId`; an out-of-scope id returns null/404 with no enumeration oracle.
- **Tokens:** bcrypt-hashed at rest, revocable + expirable, generic failure message for invalid/expired/revoked (§12.10).
- **Redemption on POST:** session minting never happens as a GET side effect.
- **Server-authoritative:** every total/balance is server-computed; the portal recomputes nothing.
- **Audit:** `portal_token_issued`/`portal_token_revoked`/`portal_contact_updated` Activity entries (additive types; portal-only event attributed to the org's earliest OWNER, §12.9).
- **noindex** on the whole route group.

## 13. UI Components

Built only from the existing design system (`Button`, `Input`, `MoneyDisplay`, `StatusBadge`, `EmptyState`, lucide icons, Tailwind tokens). Mobile-responsive (stacked nav, responsive grids), with loading (`useTransition` pending states), empty (`EmptyState`), and error (toast + portal `not-found`) states, and accessible labels/`aria-current`/`role="alert"`. No redesign of the staff app.

## 14. Files Created

**Feature (`src/features/customer-portal/`)** — `session.ts`, `queries.ts`, `actions.ts`, `staff-actions.ts`, `staff-queries.ts`; components `PortalNav.tsx`, `PortalLoginForm.tsx`, `PortalQuoteView.tsx`, `QuoteDecisionButtons.tsx`, `PortalInvoiceView.tsx`, `PortalJobTimeline.tsx`, `PortalContactForm.tsx`, `PortalFileList.tsx`, `PortalAccessPanel.tsx`, `IssuePortalTokenForm.tsx`, `RevokePortalTokenButton.tsx`.

**Routes (`src/app/(portal)/`)** — `layout.tsx`; `portal/login/page.tsx`; `portal/(app)/{layout,page,not-found}.tsx`; `portal/(app)/quotes/{page,[id]/page}.tsx`; `portal/(app)/invoices/{page,[id]/page}.tsx`; `portal/(app)/jobs/{page,[id]/page}.tsx`; `portal/(app)/account/page.tsx`; `portal/documents/[type]/[id]/route.ts`.

**Tests** — `session.test.ts`, `queries.test.ts`, `actions.test.ts`, `staff-actions.test.ts`, `import-boundary.test.ts`, `components/portal.render.test.tsx`.

**Test infra** — `src/test/server-only-stub.ts`.

## 15. Files Modified

- `src/lib/auth-routes.ts` — added `PORTAL_ROUTE` + `portal` classification bucket (additive).
- `src/middleware.ts` — pass-through for the `portal` bucket (additive).
- `src/features/customer-portal/validation.ts` — added `issuePortalTokenFormSchema` + reused `portalContactSchema` (picked from `customerSchema`).
- `src/app/(dashboard)/customers/[id]/page.tsx` — rendered `PortalAccessPanel` in the overview.
- `vitest.config.ts` — added a `server-only` → stub alias (test-only).

No existing function signature, route, schema, or frozen API was changed.

## 16. Packages Installed

**None.** The portal cookie reuses Node's `crypto` HMAC (same primitive as `lib/tokens.ts`); token hashing reuses the existing `bcryptjs` via `lib/secrets`.

## 17. Commands Executed

`npx tsc --noEmit` · `npx eslint .` · `npx vitest run` · `npx next build`.

## 18. Testing Results

| Gate | Result |
|---|---|
| Typecheck | ✅ 0 errors |
| Lint | ✅ 0 errors / 0 warnings |
| Tests | ✅ **72 files / 416 tests** (was 66/379 — **+6 files / +37 tests**, zero regressions) |
| Build | ✅ Compiled; all `/portal/*` routes generated |

New coverage: session sign/verify/tamper/expiry; portal action ownership + actor + validation + redemption; query scoping/IDOR + document-ownership + file gating; staff issue/revoke; the **import-boundary** plane-isolation suite; and component render (decision-button gating, receipt-link gating, four-link nav).

## 19. Problems Encountered

1. **`readonly` array poisoned Prisma arg inference** in `queries.ts` (cascaded into phantom `items`/`any` errors) — fixed by typing `VISIBLE_QUOTE_STATUSES` as a mutable `QuoteStatus[]`.
2. **`server-only` unresolvable under Vite** at transform time (so `vi.mock` couldn't help) — fixed with a test-only alias to an empty stub (`src/test/server-only-stub.ts`).
3. **`vi.mock` hoisting** referencing a top-level `const db` ("Cannot access 'db' before initialization") — fixed with `vi.hoisted`.
4. **Import-boundary false positives** — the test originally scanned raw source, flagging the explanatory comments that *name* `requireSession`/`requirePortalSession` to document the boundary; fixed to scan only `import` statements.

## 20. Architecture Compliance

- **Reuse, never duplicate:** accept/decline, renderDocument, lib/money, customer contact schema, getAttachmentsForEntity, Configuration Service, Activity, design system — all consumed as built.
- **Isolation of untrusted surface:** separate cookie/claim/path + CI-enforced import boundary (§22.1/§25).
- **Server-authoritative:** the portal computes no total/balance/transition.
- **Additive-only:** new route bucket, new Activity types, zero schema/dep changes; frozen APIs untouched; Decimal discipline intact.
- **Engineering decision — split actions:** the staff issuance lives in `staff-actions.ts` (separate from the customer-plane `actions.ts`) so §12.12's import-boundary guarantee is mechanical and testable, honoring both §8's folder intent and §22.1's separation mandate.

## 21. Recommended Next Milestone

**Phase 6B — Step 5: Email System (§11).** `EmailProvider`/`ConsoleEmailProvider` + `EmailLog` already exist; once funded (Resend), `issuePortalToken()`'s link auto-sends via `sendTemplatedEmail()` with zero new portal code (§12.13), and a self-service "magic link" login becomes possible. (Per the phased-delivery rule, **not started** — awaiting approval.)

---

### Deferred (documented, not skipped)
- Portal notifications (no customer-facing Notification entity; §12 specifies none).
- Email-delivered links / self-service magic-link login (needs funded Email; §12.13).
- Online payment from the portal (needs a payment integration; §5/§12.13).
- Session renew-on-activity (RSC read paths can't mutate cookies; re-issued on each login).
- Clean commits: changes are staged in the working tree but **not committed** — Phase 6A/6B Steps 1–3 are also uncommitted in this repo, so committing is left to you to avoid bundling prior steps unintentionally. Suggested grouping: (a) session+routing, (b) queries+actions, (c) UI+routes, (d) tests+report.
