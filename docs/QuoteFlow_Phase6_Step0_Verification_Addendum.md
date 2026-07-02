# QuoteFlow — Phase 6 Step 0: Pre-Implementation Verification Addendum

| | |
|---|---|
| **Status** | Completed 2026-06-28 |
| **Scope** | Phase 6A (Infrastructure & Extensibility Foundation) |
| **Authority** | `QuoteFlow_Phase6_Advanced_Platform_Architecture.md` §29 Step 0 |

Per the Phase 6 freeze rule (§1) and Step 0 (§29), every assumption the architecture makes against the live, frozen codebase was mechanically verified before any new code was written. Mismatches are recorded here as one-line documentation addenda rather than worked around silently in code. None of the findings required a change to the frozen schema or to any Phase 1–5 artifact.

## Verified assumptions (confirmed as documented)

- **`ActionResult<T>` contract** — `src/types/index.ts`: exactly the `{ success: true; data } | { success: false; error }` shape §6/§21.10 assume. Reused, not redefined.
- **Server-action error mapping** — `src/lib/errors.ts` exports `toActionError()` and `BusinessRuleError`; the `UrlPasteProvider` validation reuses `BusinessRuleError` rather than inventing an error type.
- **Tenant scope helper** — `src/lib/permissions.ts` exports `requireCompanyScope()` returning `{ organizationId }`. Every Phase 6A surface that will read tenant data routes through it; the event taxonomy carries `organizationId` on every payload to match.
- **Structured logger** — `src/lib/logger.ts` exports `logger.{info,warn,error}`. All Phase 6A infrastructure logging uses it; no new logging mechanism introduced.
- **Validated env access** — `src/lib/env.ts` is the single Zod-validated env surface. New provider-selection variables were added here (not read ad-hoc from `process.env`), consistent with the existing pattern.
- **Prisma singleton** — `src/lib/db.ts` exports the `db` singleton on `globalThis`. The event bus, job queue, and provider registry follow the same module-level singleton discipline.
- **`AUTH_SECRET` availability** — present and required in `env.ts`; available to any new server module (relevant to the deferred Portal/API planes, untouched in 6A).
- **`lib/tokens.ts` (frozen Quote share-link HMAC)** — confirmed unused and unmodified by Phase 6A, per §7.2.7's explicit non-modification instruction.

## Findings (documented reconciliations)

1. **Feature-flag naming differs from the document.** The architecture refers to flags as `aiEnabled` / `emailProviderEnabled` (§16.2 etc.). The implemented, frozen Phase 4 schema (`src/lib/config/schema.ts`, `FeatureFlagsSchema`) names them `ai` / `portal` / `automation` / `advancedReports` / `invoicing` / `integrations`.
   - **Resolution:** the implemented schema names are canonical. Phase 6 subsystems gate on them (AI → `ai`, Portal → `portal`, …). A centralized flag framework **already exists** (`src/lib/config/flags.ts`); Phase 6A reuses and extends it rather than building the `lib/feature-flags.ts` the document's §8 folder tree names — honoring the brief's "No module should implement its own feature flag logic." The only addition is a client-safe exposure helper (`getClientFeatureFlags`).

2. **`@react-pdf/renderer` is not installed.** §6.1/§10.6 describe `ReactPdfRenderer` as "already in the stack"; it is absent from `package.json`.
   - **Resolution:** PDF generation (templates + engine) is Step 2, explicitly out of Phase 6A's infrastructure-only scope. Phase 6A ships the `DocumentRenderer` interface and `resolveDocumentRenderer()` with a safe placeholder default (`UnconfiguredDocumentRenderer`) that throws a typed `ProviderNotConfiguredError` if rendering is attempted. Step 2 installs the package and registers `ReactPdfRenderer` — no interface, resolver, or call-site change. No dependency was installed in 6A.

3. **Rate-limiter name collision.** §21 specifies `lib/rate-limit/`; a frozen Phase 3 login limiter already occupies `src/lib/rate-limit.ts`.
   - **Resolution:** the new API `RateLimiter` abstraction lives in the `src/lib/rate-limit/` **folder** (`limiter.ts`, `db-rate-limiter.ts`, `resolve.ts`); the frozen `rate-limit.ts` file is untouched. No `index.ts` was added to the folder, so the bare specifier `@/lib/rate-limit` continues to resolve unambiguously to the frozen login limiter. The two are distinct surfaces (failed-login throttling vs. authenticated-API request bounding) and do not share state.

4. **Schema migration (§29 Step 1) is deferred to Phase 6B.** The nine new tables and two additive columns are feature-specific persistence consumed by Steps 2–14, not by the cross-cutting foundation.
   - **Resolution:** **Phase 6A introduces zero schema changes.** Every zero-cost default adapter built in 6A (console email, null AI, URL-paste storage, sliding-window rate limiter, in-memory job queue) operates entirely without new tables; the `EmailLog` / `AiUsageLog` / `WebhookDelivery` writes belong to their feature steps. This maximizes backward compatibility — the hard requirement of the authorization brief — and keeps `prisma/schema.prisma` provably untouched (`git status` shows no change to it). Step 1's single migration is the first task of Phase 6B.

## Completion criteria (§29 Step 0)

- [x] Every assumption above resolves to a confirmed name/shape or a recorded one-line reconciliation.
- [x] No frozen-schema assumption is left unverified.
- [x] No mismatch was worked around silently in code — each is documented here.
