# QuoteFlow — Phase 6B Step 9 Implementation Report

## AI Platform

**Status:** ✅ Complete · **Date:** 2026-07-02 · **Scope:** Phase 6B Step 9 only (§16 AI Layer / §29 "Step 14").

---

## 1. Executive Summary

Step 9 ships the provider-agnostic **AI assistance layer** exactly as §16 defines it: fully wired, **off by default, costing nothing** until an Owner flips the per-organization `ai` feature flag *and* a funded provider is configured. Two AI-assisted actions (`generateQuoteDraft`, `summarizeJob`) follow the §16.7 flow — flag check → pre-scoped entity load → `AIProvider.complete()` → `AiUsageLog` write → suggestion returned — and the `AiSuggest` affordance (button + Accept/Discard draft panel) is wired next to the Quote Builder's notes field (lead-originated quotes) and the Job detail's notes field. AI proposes; the existing, validated save actions dispose — the AI layer never writes a business field (§16.6).

**Zero new dependencies. Zero schema changes.** The `AIProvider` interface, `NullAIProvider`, resolver, `AiUsageLog` table/repository/validation, and the `ai` feature flag all shipped in 6A/Step 1 — Step 9 is their designed consumer. No workflow gained a dependency on AI (§16.1): every assisted field still has its complete manual path.

## 2. Objectives Completed

- ✅ `generateQuoteDraft(leadId)` (§16.6's exact surface) — OWNER/STAFF, drafts customer-facing quote notes from the pre-scoped originating Lead.
- ✅ `summarizeJob(jobId)` — any role that can edit the job; FIELD restricted to their own assigned job (§16.8 — permission rides the entity, no new tier).
- ✅ Flag gate first (§16.10): flag off ⇒ typed failure, **zero** provider resolution, zero DB entity read, zero usage row (test-enforced).
- ✅ Usage ledger (§16.2): every provider call — including zero-cost null calls — writes `AiUsageLog` (feature, provider name, tokens, 4dp decimal-string cost), so cost reporting is correct from the first real call.
- ✅ Pure prompt builders (§16.9): `buildQuotePrompt`/`buildJobSummaryPrompt` receive pre-scoped plain objects, never ids — no DB access in the prompt path at all; cross-tenant prompt injection is impossible by construction.
- ✅ `AiSuggest` component (§16.5): renders **nothing** when the flag is off (not rendered-then-disabled); dismissible; suggestion shown with explicit Accept/Discard, never auto-applied; provider failure surfaces as "AI suggestion unavailable right now" without touching the save path.
- ✅ Wired at both §16.5-named placements: Quote Builder notes (shown only for lead-originated quotes, matching the action's signature) and Job notes; the `ai` flag reaches both via the already-cached Company Config at page load (§16.11 — no extra query).
- ✅ Staff-plane only (§16.9): no portal or `/api/v1` caller can reach an AI action.

## 3. Architecture

`Staff clicks AiSuggest → generateQuoteDraft()/summarizeJob() → isFeatureEnabled("ai") → org-scoped entity load → resolveAiProvider().complete({prompt, feature}) → recordAiUsage() → suggestion → Accept merges into the field state → the existing save action persists` — §16.7 verbatim. The flag name is the canonical Phase 4 schema key `ai` (the document's `aiEnabled`), per the frozen Step 0/6A reconciliation already recorded in `lib/config/flags.ts`. Provider selection stays env-driven and separate from the per-org flag (§6.1): flipping `ai` on with `AI_PROVIDER=null` yields an empty completion, which the action reports as the calm unavailable message (§16.10) — while still logging the zero-cost usage row. A funded `AnthropicProvider`/`OpenAiProvider` remains one plain-`fetch` adapter file + `AI_PROVIDER=…` (§16.13); nothing in this step changes when it lands.

## 4. Components Implemented

| Component | File(s) | §Ref |
|---|---|---|
| Prompt builders (pure) | `src/features/ai/prompts.ts` | 16.6, 16.9 |
| AI-assisted actions + shared complete-and-log tail | `src/features/ai/actions.ts` | 16.6–16.10 |
| `AiSuggest` (button + draft panel, flag-invisible) | `src/features/ai/components/AiSuggest.tsx` | 16.5, 16.10 |
| Quote Builder wiring (lead-originated notes) | `QuoteBuilder.tsx` (+`aiEnabled` prop), `quotes/new/page.tsx` | 16.5 |
| Job notes wiring | `JobOverview.tsx` (+`aiEnabled` prop), `jobs/[id]/page.tsx` | 16.5 |

## 5. Files Created

`src/features/ai/prompts.ts` · `src/features/ai/actions.ts` · `src/features/ai/components/AiSuggest.tsx` · `src/features/ai/actions.test.ts` · `src/features/ai/prompts.test.ts` · this report.

## 6. Files Modified

- `src/features/quote-builder/components/QuoteBuilder.tsx` — optional `aiEnabled` prop; `AiSuggest` under the notes field when a `leadId` is present (accepting appends to non-empty notes rather than overwriting).
- `src/app/(dashboard)/quotes/new/page.tsx` — passes `config.featureFlags.ai` (config was already loaded).
- `src/features/jobs/components/JobOverview.tsx` — optional `aiEnabled` prop; `AiSuggest` under the job-notes textarea.
- `src/app/(dashboard)/jobs/[id]/page.tsx` — loads company config (cached) and passes the flag.

All additive and defaulting off; no frozen behavior changed.

## 7. Packages Installed

**None** (§16.13's no-SDK discipline — a future real adapter is plain `fetch`).

## 8. Commands Executed

`npx tsc --noEmit` · `npm run lint` · `npx vitest run` · `npm run build` — all green.

## 9. Testing Results

| Gate | Result |
|---|---|
| TypeScript | ✅ 0 errors |
| ESLint | ✅ 0 errors / 0 warnings |
| Vitest | ✅ **97 files / 566 tests** (Step 8 baseline 95/555 → +2 files / +11 tests, zero regressions) |
| Next build | ✅ Compiled; all routes generated |

New coverage (§16.12 verbatim): flag-off ⇒ no provider/no usage/no entity read; mocked-provider call writes `AiUsageLog` with correct tokens/cost; org-scoping security tests (foreign lead fails before any provider call; FIELD blocked from another's job with a non-revealing message); empty-completion misconfig path (unavailable + usage still logged); provider-error degradation; prompt-builder fact inclusion/omission (pure — no DB reachable from crafted input).

## 10. Problems Encountered

Only one, minor: a prompt-content test initially matched the instruction text ("If raw notes are provided…") instead of the fact line — tightened the assertion. No architectural reconciliations were needed; the 6A foundation fit exactly.

## 11. Architecture Compliance

- ✅ AI strictly optional system-wide; off by default for every org; zero network calls until enabled AND funded (§16.1).
- ✅ Single `AIProvider` interface via the Provider Registry; `NullAIProvider` never user-reachable (UI hides the affordance; the action reports unavailable) (§16.6/16.10).
- ✅ AI never writes business data — suggestion strings only, accepted through existing validated save actions (§16.6).
- ✅ Prompts from pre-scoped server data only; staff-plane only; permissions ride the entity (§16.8/16.9).
- ✅ Usage/cost observable from call one; `costEstimate` as `Decimal`, never a float (§16.2/§5).
- ✅ No caching of AI output; flag check rides the existing config cache (§16.11). Zero deps; zero schema; additive only.

**Deliberate deferral (named):** `draftEmail` — §16.7 names it in the generic data flow, but §16.5 defines no UI placement for it; it is an additional `feature` value on the same interface (§16.13) whenever a surface is designed, not a new subsystem.

## 12. Recommended Next Milestone

**Phase 6B Step 10 — Advanced Reporting & Analytics** (§17 Dashboard Expansion + §18 Reporting Expansion): approved and proceeding next.

---

*Phase 6B Step 9 complete. Continuing to Step 10 under the standing approval for Steps 9–11.*
