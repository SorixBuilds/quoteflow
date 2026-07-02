# QuoteFlow — Phase 6B Step 5 Implementation Report

## Email System

**Status:** ✅ Complete · **Date:** 2026-06-29 · **Scope:** Phase 6B Step 5 only (no Workflow Automation, Public API, AI, or Integrations).

---

## 1. Executive Summary

Phase 6B Step 5 delivers QuoteFlow's production-ready **Email System** — the centralized communication layer every current and future module routes outbound mail through. It is built on the Phase 6A Provider Registry and the Phase 6B Step 1 `EmailLog` model, reuses the Document Engine (`renderDocument`) for PDF attachments and the Company Configuration Service for sender identity/branding, and ships with **zero new dependencies**.

The system preserves the frozen zero-cost posture by default: with `EMAIL_PROVIDER=console` (the default) every email is fully rendered, attached, logged, and recorded as **SIMULATED** — nothing leaves the building. Funding real delivery is a pure configuration change — `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` — with **no change to any template, service, or call site**. The production adapter talks to the Resend REST API directly via `fetch`, so adopting real email adds no SDK to the bundle.

All four verification gates pass: TypeScript (0 errors), ESLint (0 errors / 0 warnings), Vitest (**79 files / 465 tests**, up from 72 / 416 — **+7 files / +49 tests, zero regressions**), and `next build` (✓ compiled, all routes generated including the new `/settings/email`).

---

## 2. Objectives Completed

- ✅ Provider infrastructure: interface, resolution, console default, **production Resend provider**, graceful fallback.
- ✅ Ten reusable templates with branding, logo, colors, footer, signature, dynamic placeholders, responsive HTML, and plain-text alternative.
- ✅ Deterministic rendering pipeline with a single HTML producer and universal escaping.
- ✅ Portal integration — invitation email auto-sent at token issuance, carrying the secure login link.
- ✅ Quote integration — sent / accepted / declined, Quote PDF attached.
- ✅ Invoice integration — invoice issued / payment received, Invoice + Receipt PDFs attached.
- ✅ Job notifications — scheduled / completed.
- ✅ Email logging — every attempt writes exactly one `EmailLog` row through its lifecycle.
- ✅ Configuration — sender name / email / reply-to / footer / signature via the existing Company Configuration Service (additive, no version bump).
- ✅ Security — org isolation, recipient validation, header-injection guard, HTML escaping, server-derived `from`, no arbitrary-send surface.
- ✅ Admin UI — Email History tab, delivery-status badges, Resend button, settings page with live preview.
- ✅ Comprehensive tests + all gates green.

---

## 3. Email Architecture

```
Business event (sendQuote, recordPayment, scheduleJob, issuePortalToken, …)
        │  (additive, non-fatal final line)
        ▼
notify*  ──►  build*Email  ──►  loads entity, formats money/dates (shared lib),
   (dispatch.ts)                 renders PDF via renderDocument() (Document Engine)
        │
        ▼
sendTemplatedEmail (send.ts, server-only)
        │  resolveEmailProvider()  ·  getEmailContext() (sender + brand)
        │  renderTemplate() ─► subject / HTML / plain-text
        ├─► createEmailLog(QUEUED)         (one row per attempt)
        ├─► provider.send()                (console = SIMULATED · resend = SENT)
        └─► updateEmailLogStatus(terminal) (single terminal update, attempts++)
```

Every arrow reuses existing logic; the Email System sequences calls, it never duplicates a calculation, a render, or a config read.

---

## 4. Provider Infrastructure

- **Interface** — `EmailProvider extends Provider { send(EmailMessage): Promise<EmailSendResult> }` (`providers/types.ts`). `EmailMessage` was extended **additively** with optional `replyTo` and `attachments` (binary PDFs), so every prior call site is unaffected.
- **Resolution** — `resolveEmailProvider()` goes through the Phase 6A `providerRegistry` (the sole DI seam); tests/DI override the slot without real infrastructure.
- **Default (console)** — `ConsoleEmailProvider` renders + logs (name/size of attachments only, never bytes) and reports success with no `providerMessageId` ⇒ recorded as **SIMULATED**.
- **Production (resend)** — `ResendEmailProvider` POSTs to `https://api.resend.com/emails` via `fetch` (no `resend` SDK). Maps non-2xx and transport errors to a `FAILED` result without ever throwing.
- **Graceful fallback** — `EMAIL_PROVIDER=resend` with no `RESEND_API_KEY` logs a warning and degrades to the console adapter, so a misconfigured production env still records SIMULATED rather than 500-ing a quote send.

No business module imports a third-party email SDK — there is no SDK, only an HTTP call behind the interface.

---

## 5. Email Templates

Ten pure template functions (`templates/index.ts`), keyed by `EMAIL_TEMPLATES`:

`portal_invitation`, `portal_login`, `quote_shared`, `quote_accepted`, `quote_declined`, `invoice_issued`, `payment_received`, `job_scheduled`, `job_completed`, `general_notification`.

Each receives an already-formatted, **markup-free** data payload (money/dates formatted server-side, exactly as the PDF templates receive pre-formatted strings) plus the tenant `EmailBrand`, and returns a structured `TemplateBody` (paragraphs, key/value rows, line items, totals, notes, optional CTA). Adding an eleventh event is one data type + one `case` — the additive discipline the platform follows.

---

## 6. Rendering Pipeline

`templates/layout.ts` is the **single HTML producer**. Template functions emit only structured data; the layout turns it into a branded, responsive HTML document **and escapes every interpolated value** (`escapeHtml`), plus a `renderText` plain-text alternative. `safeUrl` allows only `http(s)`/`mailto:` schemes through `href`s. `renderTemplate(input, brand)` is the deterministic entry point (same input ⇒ identical output), so snapshot-style tests are stable. Branding (logo or company-name fallback, primary/accent colors, footer, signature) is integrated uniformly through `EmailBrand`.

---

## 7. Portal Integration

`issuePortalToken` (staff action) now auto-delivers a branded **portal invitation** email carrying the one-time `/portal/login?token=…` link the moment a token is issued — replacing manual out-of-band sharing (§4) — when the customer has an email on file. The link is still returned so staff can copy it if delivery is simulated. The existing `PortalAccessToken` infrastructure and the second auth plane are unchanged; the token plaintext is shown once and never stored, so portal invitations are dispatched inline (not retryable from the entity).

---

## 8. Quote Integration

- `sendQuote` → `quote_shared` with the **Quote PDF** attached (via `renderDocument("quote", …)`).
- `acceptQuote` → `quote_accepted` confirmation.
- `declineQuote` → `quote_declined` confirmation.

Each is a single additive, non-fatal line at the end of the existing action; the frozen accept/decline business logic and concurrency guarantees are untouched.

---

## 9. Invoice Integration

- `createInvoice` → `invoice_issued` with the **Invoice PDF**.
- `recordPayment` → `payment_received` with the **Receipt PDF** (current paid/balance recomputed via the shared `lib/money` path).

Reuses the existing PDF generation; no calculation is duplicated.

---

## 10. Job Notifications

- `scheduleJob` → `job_scheduled` (only when a date is set).
- `changeJobStatus` → `job_completed` on the COMPLETED transition.

Reuses the existing Job services; the rescheduled case is covered by `job_scheduled` re-firing on a new date.

---

## 11. Email Logging

Every send writes **exactly one** `EmailLog` row per attempt: `QUEUED` on entry, then a single terminal-status update (`SIMULATED` / `SENT` / `FAILED`), incrementing `attempts`. Each row records organization, recipient, from-address, subject, template type, related entity, provider message id, status, error, and timestamps. Retry (§11.10) re-enters the **same row** (`existingLogId`), re-rendered fresh from the related entity — never from stored HTML.

---

## 12. Configuration

The Company Configuration Service is the sole reader/writer of sender identity. `config.email` was extended **additively** with `senderName`, `senderEmail`, `replyTo`, `footer`, `signature` (all defaulted) — a purely additive change requiring no schema-version bump (upgrade-on-read defaults fill any legacy blob). `getEmailContext()` derives the `from`/`reply-to`/brand bundle server-side; a blank sender email falls back to `EMAIL_FROM_DEFAULT`.

---

## 13. Security

- **Organization isolation** — `sendTemplatedEmail` scopes every `EmailLog` write to the caller-proven `organizationId`; history reads re-derive org from the staff session, never the URL.
- **No arbitrary-send surface** — `sendTemplatedEmail` is a `server-only` function, **not** a `"use server"` action (§11.8 closes the spam-relay class). The only client-callable actions are `retryEmail` and `previewEmailTemplate`, both OWNER/STAFF-gated.
- **Recipient validation** — invalid addresses are recorded `FAILED` and never handed to the provider.
- **Header-injection guard** — display names are CR/LF-stripped and RFC 5322-quoted; `from`/`reply-to` are config-derived, never client-supplied.
- **HTML escaping** — templates emit no markup; the layout escapes every value and neutralizes non-http(s)/mailto link schemes. Preview renders in a `sandbox=""` iframe.
- **Secure attachments** — only server-rendered PDFs from the Document Engine; no user-supplied files.

---

## 14. Files Created

**Email feature (`src/features/email/`)**
- `branding.ts` — sender identity + `EmailBrand` derivation, `getEmailContext`.
- `templates/layout.ts` — escaping, `safeUrl`, HTML + plain-text producers.
- `templates/index.ts` — 10 templates, registry, `renderTemplate`.
- `providers/resend-provider.ts` — production Resend adapter (fetch).
- `send.ts` — `sendTemplatedEmail` (server-only), `getRetryableLog`.
- `dispatch.ts` — `build*Email` + `notify*` + `rebuildEmailJob` + `isRetryableTemplate`.
- `actions.ts` — `retryEmail`, `previewEmailTemplate` (the only `"use server"` surface).
- `queries.ts` — `listEmailHistoryForEntity` (auth-scoped view).
- `labels.ts` — template/status presentation maps.
- `components/EmailHistoryList.tsx`, `components/ResendEmailButton.tsx`, `components/EmailPreview.tsx`.

**Settings & route**
- `src/features/settings/components/EmailSettingsForm.tsx`.
- `src/app/(dashboard)/settings/email/page.tsx`.

**Tests**
- `branding.test.ts`, `templates/templates.test.ts`, `providers/resend-provider.test.ts`, `providers/resolve-fallback.test.ts`, `send.test.ts`, `dispatch.test.ts`, `actions.test.ts`.

**Docs** — this report.

---

## 15. Files Modified

- `src/lib/config/schema.ts`, `src/lib/config/defaults.ts` — additive `config.email` sender fields.
- `src/lib/env.ts`, `.env.example` — optional `RESEND_API_KEY`, `EMAIL_FROM_DEFAULT`.
- `src/features/email/providers/types.ts` — `EmailAttachment`, `replyTo` (additive).
- `src/features/email/providers/console-provider.ts` — log replyTo/attachments.
- `src/features/email/providers/resolve.ts` — resend wiring + graceful fallback.
- `src/features/quotes/actions.ts` — `notifyQuoteShared` / `notifyQuoteDecision`.
- `src/features/invoices/actions.ts` — `notifyInvoiceIssued` / `notifyPaymentReceived`.
- `src/features/jobs/actions.ts` — `notifyJobScheduled` / `notifyJobCompleted`.
- `src/features/customer-portal/staff-actions.ts` — `notifyPortalInvitation`.
- `src/components/shared/EntityDetailTabs.tsx` — Email tab on every entity.
- `src/features/settings/components/SettingsNav.tsx` — Email Delivery link.

---

## 16. Packages Installed

**None.** Zero new dependencies. The production provider uses the built-in `fetch` against the Resend REST API; no `resend` SDK is added.

---

## 17. Commands Executed

```
npx tsc --noEmit
npx eslint .
npx vitest run            # + scoped: npx vitest run src/features/email
npx next build
```

---

## 18. Testing Results

| Gate | Result |
|------|--------|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| ESLint (`eslint .`) | ✅ 0 errors / 0 warnings |
| Vitest (`vitest run`) | ✅ **79 files / 465 tests** (was 72 / 416 → +7 / +49) |
| Next build | ✅ Compiled successfully; `/settings/email` + all `/portal/*` routes generated |

Coverage added: provider resolution + graceful fallback, Resend request shape + success/failure mapping, template rendering / escaping / branding / plain-text / determinism, recipient validation, one-row-per-attempt invariant, SIMULATED/SENT/FAILED mapping, provider-swap shape equality, retry-on-same-row, each dispatch builder + null recipient, retry re-derivation + retryability classification, and the retry/preview actions. No existing test was modified or skipped.

---

## 19. Problems Encountered

- **§11.6 vs §11.8 contradiction.** The architecture's code sample places `sendTemplatedEmail` in `actions.ts`, but §11.8 forbids a client-callable arbitrary-send surface. Resolved by making `sendTemplatedEmail` a `server-only` module function (`send.ts`) and reserving `actions.ts` for the permission-checked `retryEmail`/`previewEmailTemplate` only.
- **Production provider without a dependency.** Reconciled §1 ("production provider", "no SDK dependency") with the zero-cost philosophy by implementing Resend over `fetch` — a real funded path, zero packages.
- **Retry of non-derivable templates.** Token-bearing portal links and the entity-less general notification cannot be re-rendered from an entity, so the Retry control is offered only for the seven entity-derived templates; `rebuildEmailJob` returns null otherwise.
- **vitest hoisting.** Two mock factories referenced top-level vars; fixed with `vi.hoisted` (the established Step 4 pattern).

---

## 20. Architecture Compliance

- **Provider Registry / DI** — all selection through `providerRegistry`; no `new` of a concrete provider in feature code; no branching on provider identity except SIMULATED vs SENT.
- **Zero duplicated business logic** — money via `lib/money`, dates via `lib/pdf/format`, PDFs via `renderDocument`, config via the Configuration Service, tokens via the existing portal infrastructure.
- **Server-authoritative** — `from`/`reply-to`/org all server-derived; email is only ever triggered from inside an already-permission-checked action.
- **Additive & backward-compatible** — optional `EmailMessage` fields, additive `config.email`, additive Email tab, additive action lines. No existing behavior changed; no schema migration (the `EmailLog` model from Step 1 is reused as-is).
- **Shared rendering / notification infrastructure** — one template registry, one layout, one log model.

---

## 21. Recommended Next Milestone

**Phase 6B Step 6 — Workflow Automation Engine** (architecture §15). The Email System is the precondition: §15's `runAction()` dispatches `send_email` straight to `sendTemplatedEmail()`, and the email retry loop (§11.10) becomes a time-based trigger once a cron runner exists. The provider-agnostic `EmailProvider` interface, the `EmailLog` lifecycle, and the dispatch helpers built here are exactly what the automation engine sequences — no email code needs revisiting. (Funding real delivery — `EMAIL_PROVIDER=resend` + a verified domain — is an independent ops switch that can happen at any time, with no code change.)

---

*End of Phase 6B Step 5 Implementation Report.*
