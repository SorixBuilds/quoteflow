# QuoteFlow — Phase 4 Implementation Report

**Phase:** 4 — Core Platform Foundation (Frozen Architecture Spec v2.0)
**Status:** Complete
**Completed:** 2026-06-27
**Source of truth:** `docs/QuoteFlow_Phase4_Core_Business_Foundation_Architecture_v2.0.md`

---

## 1. Executive Summary

Phase 4 builds the operating-system layer every future business module imports rather than reinvents: a versioned Company Configuration system, atomic quote/invoice numbering, a polymorphic activity timeline, an in-app notification system, the dashboard shell (sidebar/topbar/breadcrumbs), shared page-layout primitives, shared UI states, a reusable URL-driven DataTable, a CSV export framework, ranked global search, a layered caching strategy, and a feature-flag mechanism — all on top of the frozen Phase 2 schema and Phase 3 auth.

All 18 roadmap steps are implemented. Final gates are green: **typecheck**, **lint**, **163 unit/component/integration tests across 27 files**, and a clean **`next build`**. Four Prisma migrations are applied and the database is in sync.

## 2. Architecture Compliance Confirmation

- **Frozen schema honored.** Only additive/incremental migrations were made: one enum value (`EntityType.ORGANIZATION`), two counter columns on `Organization`, and a new `Notification` model. No existing table, column, or relationship was redesigned.
- **Configuration Service is the sole `settings` path.** A grep confirms `Organization.settings` is read/written only inside `lib/config/` (`cache.ts` reads, `service.ts` writes); every other module goes through `getCompanyConfig`/`updateCompanyConfig`.
- **Atomic numbering, never JSON.** Counters are dedicated `Int` columns incremented via a single `UPDATE … { increment: 1 }`; no JSON counter logic exists.
- **Permission model unchanged.** No new roles or primitives; the only new helper is `requireCompanyScope()`. `updateCompanyConfig()` re-checks `requireRole(["OWNER"])` internally (defense in depth).
- **Feature flags gate UI and server actions** through the Configuration Service — no separate flag system.
- **Caching never touches authorization.** Only config, notifications, and search are cached.

### Reconciliations with the frozen Phase 2 schema (see §11)
The spec was authored against an earlier assumed schema. Three premises were reconciled in favor of the frozen schema, as authorized:
1. `Company`/`settingsJson` → the real `Organization` model and its `settings` JSON column.
2. The Activity table was **already** polymorphic (`entityType`/`entityId`, no `leadId`) — the Step 2 end-state already existed, so no destructive migration was performed; `ORGANIZATION` was added to the enum additively.
3. The numbering mandate (atomic integer counters) was implemented additively; the existing `Quote.quoteNumber`/`Invoice.invoiceNumber` columns were left as the frozen schema defines them (not made nullable), since that change was a frozen-schema refactor and not required by the numbering requirement.

## 3. Files Created

**Config (`lib/config/`)**: `schema.ts`, `defaults.ts`, `migrations.ts`, `merge.ts`, `cache.ts`, `service.ts`, `flags.ts` (+ `config.test.ts`, `service.test.ts`, `flags.test.ts`).
**Numbering**: `lib/numbering/index.ts` (+ `numbering.test.ts`).
**Permissions**: `lib/permissions.ts` (+ `permissions.test.ts`).
**Activity (`features/activity/`)**: `actions.ts`, `queries.ts`, `components/ActivityTimeline.tsx` (+ `activity.test.tsx`, `entity-type.test.ts`).
**Notifications (`features/notifications/`)**: `types.ts`, `actions.ts`, `queries.ts`, `useNotifications.ts`, `components/NotificationBell.tsx`, `components/NotificationCenter.tsx` (+ `notifications.test.tsx`).
**Settings (`features/settings/`)**: `actions.ts`, `components/{fields,CompanyProfileForm,LocaleForm,NumberingForm,BrandingForm,FeatureFlagsDisplay,SettingsNav}.tsx` (+ `settings.test.tsx`, `cache.test.ts`).
**Files (`features/files/`)**: `types.ts`, `components/FileUrlInput.tsx` (+ `files.test.tsx`).
**Tables (`features/tables/`)**: `types.ts`, `buildPrismaQuery.ts`, `useTableParams.ts`, `DataTable.tsx` (+ `tables.test.tsx`).
**Export (`features/export/`)**: `Exporter.ts`, `CsvExporter.ts`, `download.ts` (+ `export.test.ts`).
**Search (`features/search/`)**: `types.ts`, `ranking.ts`, `actions.ts`, `components/GlobalSearch.tsx` (+ `search.test.ts`).
**Layout (`features/layout/`)**: `components/PageLayout.tsx` (+ `PageLayout.test.tsx`).
**Shared components**: `components/shared/{Sidebar,Topbar,Breadcrumbs,EmptyState,ErrorState,LoadingSkeleton,SuccessToast}.tsx` (+ `Sidebar.test.tsx`, `states.test.tsx`).
**Nav config**: `config/nav.ts` (+ `nav.test.ts`).
**Routes**: `app/(dashboard)/settings/{layout,page}.tsx`, `settings/{locale,numbering,branding,features}/page.tsx`.

## 4. Files Modified

- `prisma/schema.prisma` — `EntityType.ORGANIZATION`; `Organization.nextQuoteNumber`/`nextInvoiceNumber`; `Notification` model + back-relations on `Organization`/`User`.
- `src/app/(dashboard)/layout.tsx` — new shell (Topbar with global search + notification bell, role/flag-filtered Sidebar).
- `src/app/(dashboard)/dashboard/page.tsx` — composed with `PageLayout`.

## 5. Database Migrations Added

| Migration | Step | Change |
|---|---|---|
| `…_phase4_step2_activity_entitytype_organization` | 2 | Add `ORGANIZATION` to `EntityType` (additive) |
| `…_phase4_step4_numbering_counters` | 4 | `Organization.nextQuoteNumber`/`nextInvoiceNumber Int @default(1)` |
| `…_phase4_step11_notification` | 11 | `Notification` model + index `[organizationId, userId, isRead, createdAt]` |

All applied; `prisma migrate status` → "Database schema is up to date!"

## 6. Systems Implemented

Company Configuration Service (versioned, sectioned, deep-merged, migration-on-read) · Atomic numbering · Polymorphic Activity timeline · Notifications (priority/action/metadata, bell + center) · Dashboard shell · Page-layout primitives · Settings UI (5 sub-pages) · Shared UI states · FileRef (URL-paste) · DataTable (URL state + extended contract) · CSV export (xlsx/pdf reserved-throwing) · Ranked global search · Layered caching · Feature flags (two-sided enforcement).

## 7. Step-by-Step Completion Summary (1–18)

1. **Permission/tenant helpers** — `lib/permissions.ts` re-exports Phase 3 helpers + new `requireCompanyScope()`. ✅
2. **Activity polymorphic** — verified already-polymorphic; `ORGANIZATION` enum added. ✅
3. **Config schema/defaults/migrations** — `CompanyConfigSchema`, `DEFAULT_COMPANY_CONFIG`, migration chain + deep-merge. ✅
4. **Atomic numbering** — counter columns + `lib/numbering` with atomic increment; concurrency contract test. ✅
5. **Configuration Service** — `getCompanyConfig`/`updateCompanyConfig`, OWNER-gated internally, section-aware merge. ✅
6. **Dashboard shell** — Sidebar (role/flag-filtered), Topbar, Breadcrumbs. ✅
7. **Page-layout primitives** — `PageLayout`/`PageHeader`/`PageActions`/`PageContent`/`PageSection`. ✅
8. **Settings UI** — Company Profile, Locale, Numbering & Tax, PDF & Email, Feature Flags (read-only), all via the service. ✅
9. **Shared UI states** — Empty/Error/Loading/Toast, applied to Settings, Activity, Notifications, DataTable. ✅
10. **Activity feed UI** — `logActivity`/`getActivityForEntity`/`ActivityTimeline`, proven across LEAD + ORGANIZATION/QUOTE. ✅
11. **Notifications** — model + lifecycle actions + bell/center UI. ✅
12. **FileRef** — `FileRef` contract + `FileUrlInput`, wired into Company Profile. ✅
13. **DataTable** — `useTableParams`, `parseTableParams`, `DataTable`, reserved typed props. ✅
14. **Export** — `Exporter` interface + `CsvExporter`; reserved formats throw; DataTable export hook. ✅
15. **Global search** — three-tier ranking, company-scoped, wired into Topbar. ✅
16. **Caching** — React `cache()` + tagged Data Cache + `revalidateTag`; TanStack Query 30s notifications policy. ✅
17. **Feature flags** — Sidebar reads flags (both render states tested); `requireFeatureFlag()` gates server actions. ✅
18. **Verification** — lint/typecheck/test/build green; this report. ✅

## 8. Testing Summary

- **163 tests / 27 files, all passing.**
- Unit: config parsing (empty/partial/legacy), migration chain, deep-merge, `formatNumber`, search tier ordering, CSV escaping + exporter dispatch (incl. reserved-format error), `parseTableParams` allowlists.
- Integration (mocked Prisma): config write→read round-trip + section merge + OWNER/cross-tenant guards, numbering atomic-increment contract + concurrency property, activity query ordering, notification lifecycle, search scoping/ranking, cache invalidation wiring.
- Component (RTL): Sidebar role/flag states, page primitives, shared states, settings forms (validation + unsaved-changes indicator), notification center read/unread, DataTable empty/loading/error + reserved-props compile check, FileUrlInput.

## 9. Security Review

- Tenant isolation: config, activity, notifications, and search all filter by `organizationId`; search/markRead are user-scoped.
- Owner-only settings enforced at both the action and inside the service; cross-org writes rejected.
- Numbering race resolved by design (atomic DB increment).
- `Notification.metadata` documented as app-internal, never rendered as trusted markup.
- Authorization/session reads are never cached (absolute rule upheld).
- `FileUrlInput` renders pasted URLs via a plain `<img>` (documented V1 limitation; not a permission-checked upload).

## 10. Performance Considerations

- Config reads are request-memoized (React `cache()`) over a tenant-tagged Next.js Data Cache, invalidated only on write — near-zero repeated DB cost on the per-request dashboard layout read.
- Notifications poll on a 30s TanStack Query staleness window with focus refetch.
- Search uses one indexed `contains` prefetch per entity (cap 50) then ranks in memory; `pg_trgm` is the documented upgrade path.

## 11. Issues Encountered

- **Spec vs. frozen schema mismatch** (model naming, already-polymorphic Activity, numbering nullability) — reconciled toward the frozen schema as authorized; see §2.
- **Next 16 API changes** — `revalidateTag` now requires a cache-life profile (used `{ expire: 0 }`); the `middleware` convention is deprecated in favor of `proxy` (pre-existing file, not in Phase 4 scope, left unchanged — emits a build warning only).
- **Test performance** — `userEvent` typing on controlled inputs was pathologically slow; settings form tests were rewritten with `fireEvent.change` (suite back to ~40s).

## 12. Deferred Features (unchanged from spec)

Soft delete, `AuditLog`, real email/SMS (Resend), Vercel Blob uploads, Excel/PDF exporters, `pg_trgm` search — all remain correctly deferred with documented trigger conditions.

## 13. Final Verification Results

| Gate | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run lint` | ✅ clean |
| `npm run test` | ✅ 163/163 |
| `npm run build` | ✅ success (13 routes) |
| `prisma migrate status` | ✅ up to date |

## 14. Recommendations for Phase 5

- Build the first business entity (Leads) on these primitives: a `DataTable` list page wiring `createExportHandler`, an `ActivityTimeline` on the detail view, and `logActivity` on each mutation.
- Add a real-DB concurrency test for numbering behind a `TEST_DATABASE_URL` flag.
- Decide the `Quote.quoteNumber` assignment moment (creation vs. send) when the Quote module lands, and call `getNextQuoteNumber()` there.
- Reconsider the `Organization.timezone`/`currency` columns vs. `config.businessHours.timezone`/`config.locale.currency` overlap; pick one source of truth for Phase 5.
- Migrate the deprecated `middleware.ts` to the `proxy` convention.
