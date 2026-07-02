# QuoteFlow — Phase 6B Step 7 Implementation Report

## Public API Core (Authentication + Read Endpoints)

**Status:** ✅ Complete · **Date:** 2026-07-02 · **Scope:** Phase 6B Step 7 only (no write endpoints, no webhooks, no AI, no third-party integrations).

---

## 1. Executive Summary

Step 7 ships QuoteFlow's **versioned Public API core** exactly as §21 and the §29 roadmap's "Public API Core (Authentication + Read Endpoints)" milestone define it: the third, fully isolated authentication plane (`requireApiKey()`), per-key scopes over the fixed §21.8 scope list, per-key rate limiting through the Phase 6A `RateLimiter` provider, read-only `/api/v1/*` REST endpoints for **Leads, Quotes, Jobs, Invoices, and Customers**, standardized §21.10 error/pagination envelopes, and the OWNER-only **Settings → API Keys** management screen with one-time key display, rotation, and revocation.

**Zero new dependencies. Zero schema changes.** The `ApiKey` table, the bcrypt key-minting/verification module, the prefix-narrowed repository, and the `DbRateLimiter` all shipped in Steps 1/6A precisely so this step could consume them — Step 7 is the consumer those foundations were built for.

Write endpoints and outbound webhooks are the **next milestone** (§29 "Public API Write Endpoints & Webhooks"): the architecture pairs them deliberately, and v1's additive-only versioning policy (§21.14) means shipping reads first costs nothing later.

## 2. Objectives Completed

- ✅ Third authentication plane: `requireApiKey(req, scope)` per the authoritative §21.6 flow — bearer header → indexed `keyPrefix` narrowing → constant-time bcrypt compare → scope check → rate limit → `lastUsedAt` touch.
- ✅ Versioned path: everything under `/api/v1/*`, classified as its own route bucket (like the portal's) so API callers are never cookie-gated or redirected — every failure is the JSON envelope.
- ✅ Read endpoints (list + detail) for the five §21.1 resources, each org-scoped by the key's tenant on **every** query; quote detail includes line items, invoice detail includes payments (one relation level, §23).
- ✅ Standardized shapes: `{ data, pagination }` list envelope, `{ error: { code, message } }` error envelope via one shared `apiHandler` wrapper (§21.10), offset pagination capped at 100 (§21.11), closed-set filter validation (422, never silent).
- ✅ Scoped permissions (§21.8): every endpoint demands exactly one scope; there is no scope-free route under `/api/v1/*` (§21.9).
- ✅ Rate limiting (§21.11): 100 req/60 s sliding window per key via `resolveRateLimiter()` — the Provider Registry decides the implementation, `Retry-After` advertises the delay.
- ✅ Key lifecycle: OWNER-only create (explicit scope subset, never all-by-default), **rotate** (same name/scopes, old key dies instantly), **revoke** (idempotent); full key shown exactly once (§21.9/§22.2).
- ✅ Usage & audit logging: `lastUsedAt` per key (drives §21.14 deprecation-by-evidence), structured `api.request`/`api.error` log lines, and `Activity` records for key create/rotate/revoke.
- ✅ API documentation: `docs/QuoteFlow_Public_API_v1.md` (auth, scopes, envelopes, error codes, per-endpoint fields/filters, integrator security notes).

## 3. Architecture

### 3.1 The third plane, kept disjoint (§22.1)

`requireSession()` (staff), `requirePortalSession()` (customer), and now `requireApiKey()` (machine) are three separate functions with three separate credential shapes. The new plane's isolation is enforced three ways:

1. **At the edge:** `classifyRoute()` gets an `"api"` bucket for `/api/v1/*` — middleware passes it through untouched (no cookie logic, no redirects), exactly the pattern the portal bucket established. An unauthenticated API call gets a 401 JSON envelope, never a login page.
2. **In the module graph:** a new CI-enforced import-boundary test (mirroring the portal's) proves the API plane (`lib/api/*`, `app/api/v1/*`) imports no staff/portal auth helper, and `@/lib/api/auth` is imported **only** under `app/api/v1`. `features/api-keys/actions.ts`/`queries.ts` are asserted to be the single, intentional staff-plane management bridge (OWNER session mints/revokes keys), the same role `staff-actions.ts` plays for the portal.
3. **At runtime:** the key itself establishes the tenant — `findActiveKeyCandidatesByPrefix` deliberately runs pre-tenant (§21.6), and the returned `organizationId` then constrains every Prisma query in the handler (`where: { organizationId, ... }`), the same IDOR-closing discipline every internal action follows (§22.3).

### 3.2 Handler shape (§21.6, uniform across all ten routes)

```
requireApiKey(req, "<entity>:read")
  → parseListParams / parseEnumParam / parseUuidParam   (422 on bad input)
  → org-scoped Prisma query + count (Promise.all)
  → whitelisted serializer → { data, pagination } envelope
```

All wrapped in `apiHandler()` — one catch, one envelope, opaque 500 for anything unexpected. Serializers are explicit field maps (never row spreads): money/quantities cross the wire as fixed-2 decimal **strings** (the §5 "never a JS float" rule extended to the wire), dates as ISO-8601, and internal columns (`organizationId`, `hashedKey`, `createdById`, …) cannot leak by accident. The serializer *is* the v1 wire contract, and it is pinned by tests.

### 3.3 No-enumeration posture (§21.9, §22.5 — applied uniformly)

Unknown key and revoked key produce byte-identical 401s (the narrowing query excludes revoked rows, so both are simply "no match"). Malformed, foreign, and absent resource ids produce byte-identical 404s. Nothing under `/api/v1/*` confirms the existence of anything the key cannot read.

### 3.4 Rate limiting (§21.11/§21.13 reconciliation)

`requireApiKey` consumes the `RateLimiter` interface via `resolveRateLimiter()` — the 6A provider seam. The active implementation remains the in-process sliding-window `DbRateLimiter` (100/60 s per key). A durable cross-instance counter would require a request-log table that §7.2 (the authoritative, frozen schema section) does not define, so per the "migration only if the architecture requires one" rule none was added; the architecture's own named upgrade path for durable accuracy is the §21.13 Upstash funding trigger — one new adapter file + `RATE_LIMITER=upstash`, zero route changes. This reconciliation is deliberate and documented here rather than silently resolved.

### 3.5 Rotation as composition

`rotateKey()` introduces no new credential mechanics: it is exactly `createApiKey` (same name, stored scopes re-narrowed through the closed-set guard) followed by `revokeApiKey` on the old id, with one Activity record. The §21.5 "shown once" UX applies to the replacement key identically.

## 4. Components Implemented

| Component | File(s) | §Ref |
|---|---|---|
| Typed API error + envelope + shared wrapper | `src/lib/api/error.ts` | 21.10 |
| `requireApiKey()` — third auth plane | `src/lib/api/auth.ts` | 21.6, 21.8, 21.9, 22.1 |
| List params, filters, uuid guards, envelopes | `src/lib/api/params.ts` | 21.6, 21.11 |
| Wire-contract serializers (5 entities + items/payments) | `src/lib/api/serializers.ts` | 21.6, 21.14, 5 |
| Read endpoints ×5 resources (list + detail) | `src/app/api/v1/{leads,customers,quotes,jobs,invoices}/…` | 21.6 |
| Route classification `"api"` bucket + edge pass-through | `src/lib/auth-routes.ts`, `src/middleware.ts` | 21, 22.1 |
| Key management actions (create/rotate/revoke, audited) | `src/features/api-keys/actions.ts` | 21.5, 21.9 |
| Key read path (OWNER, display-safe fields only) | `src/features/api-keys/queries.ts` | 21.5 |
| Settings → API Keys UI (one-time display, rotate, revoke) | `src/features/api-keys/components/ApiKeysManager.tsx`, `src/app/(dashboard)/settings/api-keys/page.tsx`, `SettingsNav.tsx` | 21.5 |
| Org-scoped key lookup for rotation | `src/features/api-keys/repository.ts` (`findApiKeyById`, additive) | 21.5 |

## 5. Files Created

**API plane (4):** `src/lib/api/error.ts`, `src/lib/api/auth.ts`, `src/lib/api/params.ts`, `src/lib/api/serializers.ts`

**Routes (10):** `src/app/api/v1/leads/route.ts`, `src/app/api/v1/leads/[id]/route.ts`, `src/app/api/v1/customers/route.ts`, `src/app/api/v1/customers/[id]/route.ts`, `src/app/api/v1/quotes/route.ts`, `src/app/api/v1/quotes/[id]/route.ts`, `src/app/api/v1/jobs/route.ts`, `src/app/api/v1/jobs/[id]/route.ts`, `src/app/api/v1/invoices/route.ts`, `src/app/api/v1/invoices/[id]/route.ts`

**Management (4):** `src/features/api-keys/actions.ts`, `src/features/api-keys/queries.ts`, `src/features/api-keys/components/ApiKeysManager.tsx`, `src/app/(dashboard)/settings/api-keys/page.tsx`

**Tests (6):** `src/lib/api/error.test.ts`, `src/lib/api/auth.test.ts`, `src/lib/api/params.test.ts`, `src/lib/api/serializers.test.ts`, `src/lib/api/import-boundary.test.ts`, `src/app/api/v1/leads/route.test.ts`

**Docs (2):** `docs/QuoteFlow_Public_API_v1.md`, this report.

## 6. Files Modified

- `src/lib/auth-routes.ts` — additive `API_V1_ROUTE` + `"api"` classification bucket (before the staff buckets, after public).
- `src/middleware.ts` — `"api"` pass-through branch (mirrors the portal branch).
- `src/features/api-keys/repository.ts` — additive `findApiKeyById()` (org-scoped, hash omitted).
- `src/features/settings/components/SettingsNav.tsx` — "API Keys" tab (OWNER), between Automations and Feature Flags.
- `src/lib/auth-routes.test.ts` — `/api/v1/*` classification cases (including the `/api/v2-preview` lookalike fail-closed case).

No frozen Phase 1–5 business module, portal file, email file, or automation file was touched.

## 7. Packages Installed

**None.** Key hashing (`lib/secrets` bcrypt), rate limiting (`DbRateLimiter`), the provider registry, and all UI primitives already existed. (`npm audit`-relevant surface unchanged.)

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
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| ESLint | ✅ 0 errors / 0 warnings (no disabled rules) |
| Vitest | ✅ **88 files / 521 tests passed** (Step 6 baseline: 82/486 → **+6 files / +35 tests**, zero regressions, none skipped) |
| Next build | ✅ Compiled; all ten `/api/v1/*` routes + `/settings/api-keys` generated |

New coverage (§21.12): missing/invalid/revoked key each 401 (revoked indistinguishable from unknown); insufficient scope 403; rate-limit 429 carrying the limiter's `retryAfterSeconds` and **not** counting as usage; success returns tenant+scopes and touches `lastUsedAt`; multi-candidate prefix collision resolution; pagination defaults/caps and 422s; enum/uuid filter validation; serializer money/date/whitelist/balance-floor rules; representative end-to-end handler test (scope demanded, both queries org-scoped, envelopes correct, 422 before any DB call); `/api/v1` route classification; and the three-plane import-boundary test.

## 10. Problems Encountered

1. **Next.js generated route types vs. the shared wrapper.** Next validates a non-dynamic route handler's second argument against `{ params: Promise<{}> }`; `apiHandler`'s default param type of `Record<string, never>` was not assignable. Defaulting the generic to `unknown` (dynamic routes still pass `{ id: string }` explicitly) satisfied both cases with no per-route ceremony.
2. **Client bundle vs. the crypto module.** The scope catalog lives in `key.ts`, which imports bcrypt — unimportable from a client component. The Settings UI declares a display-only scope catalog checked against the `ApiScope` union via a **type-only** import + `satisfies`, so the closed set stays compiler-enforced without pulling server crypto into the client graph.
3. **§21.6's durable rate-limit counter vs. the frozen §7.2 schema** — reconciled in §3.4 above: no table exists for it, migrations are architecture-gated, and §21.13 already names the sanctioned durability upgrade. Documented, not silently resolved.

## 11. Architecture Compliance

- ✅ Three non-interchangeable auth planes; no module imports two planes' helpers for one request (§22.1) — CI-enforced.
- ✅ Keys bcrypt-hashed, prefix-narrowed, shown once, never logged (§21.9/§22.2); scopes least-privilege from the fixed closed list (§21.8).
- ✅ No scope-free endpoint under `/api/v1/*`; `api/lead-capture` untouched and unrelated (§21.9).
- ✅ Rate limiting behind the `RateLimiter` interface via the Provider Registry — DI only, one branch point (§6.1/§21.6).
- ✅ Standardized envelopes, one shared wrapper, Zod-free params kept as small pure guards; validation errors never leak internals (§21.10).
- ✅ Offset pagination ≤ 100; list queries + counts batched via `Promise.all`; no N+1; one relation level on detail includes (§21.11/§23).
- ✅ Org isolation on every query via the key's tenant; uniform 404/401 no-enumeration posture (§22.3/§22.5).
- ✅ Additive & backward compatible: no frozen artifact modified; route bucket, repository function, nav tab all additive; zero deps; zero schema.
- ✅ Scope discipline: read-only v1 per §29's milestone split — no write endpoints, no webhooks, no OpenAPI generator dependency (the §21 design specifies none; the reference doc covers the documentation deliverable).

**Deliberate deferrals (named, not omitted):** write endpoints + the §21.12 write-equivalence test, outbound webhooks (`dispatchWebhooks`, the event bus's second consumer), and `webhooks:manage`-scoped surfaces — all belong to the next milestone (§29 "Public API Write Endpoints & Webhooks"), which pairs them by design.

## 12. Recommended Next Milestone

**Phase 6B Step 8 — Public API Write Endpoints & Webhooks (§21.6–21.7, §29):**
POST/PATCH endpoints that call the *same* internal business functions the staff UI calls (with the §21.12 equivalence test), plus `dispatchWebhooks()` subscribing to the existing event bus (its designed second consumer, after Step 6's automation engine), `Webhook`/`WebhookDelivery` lifecycle with HMAC signing and capped retry, and the Settings → Integrations webhook management UI.

---

*Phase 6B Step 7 is complete and frozen pending approval. No further milestone has been started.*
