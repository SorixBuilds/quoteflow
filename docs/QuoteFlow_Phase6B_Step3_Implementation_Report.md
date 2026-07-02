# QuoteFlow — Phase 6B Step 3 Implementation Report
## File & Media Management System (§14)

**Status:** ✅ Complete — all verification gates pass.
**Date:** 2026-06-28
**Scope:** §14 (File & Media Management) only. No Email, Portal, Automation, API, AI, or external Integrations.

---

## 1. Complete Implementation

The File & Media Management System generalizes the single-field, URL-paste pattern Phase 4 proved for `Organization.logoUrl` into a reusable, polymorphic attachment system across every business entity — **without requiring real binary storage to exist yet** (§14.1). The `FileAttachment` model and the `StorageProvider` interface + `UrlPasteProvider` default were already built (Step 1 persistence; Phase 6A provider foundation). Step 3 builds the **feature** on top of them: the read/write services, the authorization gate, the funded provider (written, not wired), and the UI.

What ships:

- **Storage layer** — `UrlPasteProvider` (live, zero-cost) and `VercelBlobProvider` (written, not wired — §14.13), both resolved through the existing **Provider Registry** via `resolveStorageProvider()`. No consumer branches on which is active.
- **Attachment services** — `attachFile`, `renameAttachment`, `removeAttachment` (writes) and `getAttachmentsForEntity` (read), all organization-scoped.
- **Authorization gate** — one entity-agnostic module (`access.ts`) enforcing the §14.8 permission model + tenant scope / IDOR prevention.
- **UI** — a **Files tab** wired once into the shared `EntityDetailTabs`, lighting up on Lead / Quote / Job / Customer / Invoice detail pages simultaneously; upload form, grouped list, thumbnails, rename, remove, download, preview, metadata.
- **Activity integration** — `file_attached` / `file_renamed` / `file_removed` logged through the existing `logActivity` framework.

---

## 2. Architecture Compliance Summary

| Requirement (§14) | How it is met |
|---|---|
| Polymorphic, entity-agnostic attachments (§14.1) | One `FileAttachment` model keyed by `(entityType, entityId)`; one Files tab serves all 5 entities; per-entity logic lives only in the single `access.ts` mapping. |
| `StorageProvider` abstraction, swappable (§14.2, §14.6) | `resolveStorageProvider()` is the sole branch point; `attachFile` calls `provider.store()` and never names a concrete provider. Funding = one resolver case + `STORAGE_PROVIDER=vercel-blob`. |
| Reuse Provider Registry / DI, no SDK leakage (§6.1) | Resolution goes through `providerRegistry.resolve(PROVIDER_KEYS.storage, …)`. No storage SDK is imported anywhere in business code (or at all — see §9). |
| Permission model (§14.8) | FIELD → own assigned Jobs only; OWNER/STAFF → any business entity; org-level (`entityType = null`) → OWNER-only. Enforced in `access.ts`. |
| URL-paste = no server fetch, no SSRF (§14.9) | Pasted URLs are stored and rendered as a plain `<img src>` / link; the server never fetches or proxies them. |
| Zod-at-the-boundary validation (§14.10) | `attachFileSchema` (http(s)-only, known category) + provider-level re-validation (defense in depth). |
| No orphan rows on store failure (§14.10) | `provider.store()` runs **before** the DB insert; a failed store throws before any row exists. |
| `getAttachmentsForEntity` read path (§14.6) | Implemented; organization-scoped, newest-first, uploader resolved, `isImage` precomputed. |
| Files tab reuses the §17 detail shell unmodified in spirit (§14.11) | Added as a server-component panel alongside Activity/Notes/Tasks — same keying, no client tab state, no extra fetch round-trip. |
| Funded `VercelBlobProvider` written, not wired (§8, §14.13) | File exists with real hardening rules; byte upload deferred behind installing `@vercel/blob` (the named funding trigger). |

---

## 3. Security Summary

- **Organization isolation** — every query is scoped by `organizationId` (reads, the existence checks in `access.ts`, and the repository writes via `updateMany`/`deleteMany` with an org predicate). A cross-tenant id is a silent no-op, never an error that leaks existence.
- **Authorization / IDOR (§14.8, §14.9)** — `canManageAttachmentTarget()` enforces *both* the role gate **and** that the parent row actually exists in the caller's org (and, for a FIELD user's Job, is assigned to them) before any attach. Rename/remove re-derive the parent from the stored row and re-check the same gate, so a guessed attachment id from another tenant is refused.
- **Filename / input sanitization** — `attachFileSchema` bounds `fileName` (1–255) and `category` (fixed enum); the rename path re-validates. The UI defaults a blank name to the URL's last path segment, decoded safely.
- **Scheme validation (no `javascript:` / `data:` / `file:`)** — enforced twice: in the Zod schema and inside `UrlPasteProvider` itself.
- **No SSRF surface** — the URL-paste mode never dereferences the pasted URL server-side.
- **Upload hardening designed now (§14.9)** — `VercelBlobProvider` carries the MIME allow-list (`image/*`, `application/pdf`), a 10 MB ceiling, and a per-organization key prefix as **real, tested** pure functions, so the funded path's security is reviewable today and enforced the moment it is wired.
- **Server-side validation only** — nothing trusts client input; every action re-authenticates (`requireSession` + `requireActiveUser`), re-scopes, and re-validates.

---

## 4. Testing Summary

**+5 test files, +32 tests** (suite: **66 files / 379 tests**, up from 61 / 347 after Step 2). Zero regressions.

| File | Covers |
|---|---|
| `providers/vercel-blob-provider.test.ts` | MIME allow-list, 10 MB ceiling, per-org prefix, payload sizing; `store()` rejects no-bytes / bad-MIME / oversize before any upload and surfaces the deferred-SDK error. |
| `providers/storage-swap.test.ts` | §14.12 provider-swap — `UrlPasteProvider` and a mock `VercelBlobProvider` produce identically-shaped `FileAttachment` rows. |
| `access.test.ts` | §14.8 permission matrix + §14.9 IDOR: org-level OWNER-only; FIELD limited to own assigned Jobs and blocked from non-Job types without a query; cross-tenant rows refused. |
| `actions.test.ts` | attach/rename/remove orchestration: provider→row ordering, Activity logging, permission denial writes nothing, non-http URL rejected at the boundary, org-level files skip Activity, DI-swapped provider's `sizeBytes` flows through. |
| `components/attachments.render.test.tsx` | `AttachmentListView` empty state, category grouping, role-gated Rename/Remove vs. always-available Download; `formatFileSize`. |

Failure paths, security paths, authorization, and organization isolation are all covered, as is the integration test the architecture explicitly names (a FIELD user can attach to their own Job but not another's — `access.test.ts`).

---

## 5. Verification Summary

| Gate | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit` | ✅ exit 0 |
| Lint | `npm run lint` | ✅ exit 0 — **0 errors, 0 warnings** |
| Tests | `vitest run` | ✅ **379 passed / 66 files** |
| Build | `next build` | ✅ Compiled successfully; all routes generated |

---

## 6. Files Created (10)

- `src/features/files/providers/vercel-blob-provider.ts` — funded adapter, written not wired (§14.13) + hardening rules.
- `src/features/files/access.ts` — single authorization + tenant-scope gate.
- `src/features/files/queries.ts` — `getAttachmentsForEntity` read projection.
- `src/features/files/actions.ts` — `attachFile` / `renameAttachment` / `removeAttachment`.
- `src/features/files/components/AttachFileForm.tsx` — URL-paste upload widget (client).
- `src/features/files/components/AttachmentRow.tsx` — row: thumbnail, metadata, rename/remove/download (client) + `formatFileSize`.
- `src/features/files/components/FileAttachmentList.tsx` — server panel (read + permission gate) and presentational `AttachmentListView`.
- `src/features/files/providers/vercel-blob-provider.test.ts`
- `src/features/files/providers/storage-swap.test.ts`
- `src/features/files/access.test.ts`
- `src/features/files/actions.test.ts`
- `src/features/files/components/attachments.render.test.tsx`

*(7 source files + 5 test files.)*

---

## 7. Files Modified (4)

- `src/features/files/repository.ts` — added `renameFileAttachment` (label-only update; never re-stores bytes).
- `src/features/files/providers/resolve.ts` — the `vercel-blob` case now returns the written `VercelBlobProvider` instead of throwing inline (the throw moved into `store()`, where the funding trigger actually lives).
- `src/components/shared/EntityDetailTabs.tsx` — added the **Files** tab (type, list, parser, panel) — one change, all 5 entities.
- `src/features/activity/components/ActivityTimeline.tsx` — registered `file_attached` / `file_renamed` / `file_removed` labels (the timeline already humanized unknowns; this is polish).

---

## 8. Packages Installed

**None.** Step 3 adds zero dependencies. The funded `@vercel/blob` package is, per §14.13, the explicit *future* funding trigger and is intentionally **not** installed; `VercelBlobProvider` is written without any SDK import so selecting it before funding fails loudly and safely.

---

## 9. Problems Encountered

- **ESLint directive placement** — a two-line comment pushed the `eslint-disable-next-line @next/next/no-img-element` off the `<img>` it was meant to suppress, surfacing as a warning (and an "unused directive" warning). Resolved by moving the disable comment to the line immediately preceding the element. The `<img>` itself is correct and intentional: a pasted external URL has no configurable next/image host and is rendered exactly as `Organization.logoUrl` already is (§14.9).
- **No other issues** — typecheck, the full suite, and the build passed without further changes.

---

## 10. Engineering Decisions

1. **One authorization module, entity-agnostic actions.** The §14.8 permission model + IDOR check live solely in `access.ts`; the three actions call `canManageAttachmentTarget()` and never special-case a type. The polymorphism that genuinely exists (mapping `entityType` → an existence query) is centralized in one audited place — the same discipline `logActivity` uses for the polymorphic `entityId`.
2. **Provider resolved, never named.** `attachFile` resolves the storage provider through the registry and consumes the `StoredFile` shape; it has no knowledge of URL-paste vs. blob. Funding real uploads changes one resolver case and an env var — nothing in the feature.
3. **`VercelBlobProvider` is written *with* its security, *without* its SDK.** The hardening rules (MIME allow-list, size ceiling, per-org prefix) are real tested functions today; only the byte upload — which needs `@vercel/blob` — is deferred, matching the architecture's "written, not wired" marker exactly.
4. **Store-before-insert ordering** guarantees §14.10's "no orphan row": a failed `store()` throws before any `FileAttachment` exists.
5. **Files tab added to the shared shell once.** Wiring it into `EntityDetailTabs` rather than per-page honors the entity-agnostic mandate and keeps the five detail pages untouched.
6. **Download stays universal; manage controls are role-gated.** Anyone who can see a record can open/download its files (a plain link, no proxy); only a caller who passes the manage gate sees Rename/Remove and the upload form.

---

## 11. Deferred Items

- **Real binary upload (`VercelBlobProvider.store()` + `@vercel/blob` + `<UploadDropzone>`)** — the §14.13 funding trigger. Provider, hardening rules, and resolver case are in place; activation is `npm i @vercel/blob`, implement the upload call, set `STORAGE_PROVIDER=vercel-blob`. Zero change to `attachFile`, the schema, or any page.
- **Organization-level "Company documents" UI surface.** Org-level attachments (`entityType = null`, OWNER-only) are fully supported at the data/service/authorization layers and tested, but no Settings screen is wired in this step (the architecture names the capability, not a screen). A future Settings tab can mount `FileAttachmentList` with a null entity.
- **Search / filter / sort / pagination over attachments** — explicitly out of scope per §14.11 ("attachment lists are small … no caching"); presentation is category-grouped, newest-first. Listed in the generic brief but deliberately not added, consistent with the frozen architecture.
- **"Replace"** under the zero-cost provider is remove + re-attach (there is no in-place binary replace until `VercelBlobProvider` is wired). Rename (label change) is implemented directly.

---

## 12. Next Recommended Milestone

**Phase 6B — Step 4: Email System (§11).** The `EmailProvider` interface + `ConsoleEmailProvider` default already exist (Phase 6A); the `EmailLog` persistence exists (Step 1). Step 4 would build the email feature (compose/send services, templates, the quote/invoice send flows) on that foundation — and attachments from this step become directly reusable as email attachments, exactly as §14.2 anticipated.

*(Not started — see Stop Condition.)*

---

## 13. Stop Condition — Honored

Step 3 is fully implemented and verified. Per the authorization, work **stops here**. No Email, Portal, Automation, AI, API, or Integrations work has begun. Awaiting explicit approval before the next milestone.

---

## 14. Phase 6B Step 3 Implementation Report

This document. Sections 1–13 above constitute the complete report: implementation, architecture-compliance, security, testing, and verification summaries; files created/modified; packages (none); problems; engineering decisions; deferred items; and the next recommended milestone.
