# QuoteFlow — Authentication & Authorization Architecture
### Phase 3 Reference Document — Official Implementation Blueprint

## Document Control

| | |
|---|---|
| **Status** | **FROZEN — Approved for Implementation** |
| **Version** | 2.0 (Finalized) |
| **Supersedes** | v1.0 (initial draft, approved in principle) |
| **Phase** | 3 — Authentication & Authorization |
| **Depends on** | Phase 1 (Project Foundation), Phase 2 (Database Foundation), Phase 2.1 (Database Hardening) — all frozen |
| **Owner** | Development OS (Architecture) |
| **Audience** | Any engineer implementing Phase 3, with no other context than this document |

---

## §1. Architecture Freeze

This document is the **official Phase 3 architecture** for QuoteFlow. As of this version, it is **frozen**.

**What "frozen" means in practice:**
- Every decision recorded in §4 through §20 is final for the purposes of Phase 3 implementation.
- Implementation must follow this document exactly. No new architectural decisions should be made during coding — if a question arises that this document doesn't answer, implementation pauses and the document is amended first, not worked around silently in code.
- The roadmap in §24, the file list in §23, and the Definition of Done in §25 are the literal scope of Phase 3. Nothing more, nothing less, unless this document changes first.

**What can justify a change to this document:**
1. A genuine **bug** discovered in the design itself (not a bug in someone's implementation of it).
2. A genuine **security vulnerability** in a recommendation made here.
3. A **business requirement change** (e.g., a real client now requires instant session revocation, or multi-organization users) that the current design cannot satisfy without modification.

**What does not justify a change:**
- Personal preference for a different library, pattern, or naming convention discovered mid-implementation.
- "I found a slightly nicer way to do X" where X already has a documented, working design here.
- Convenience shortcuts under time pressure.

**Process for proposing a change:** any alternative idea, however good, is written down in §18 (Future Expansion) or as a new entry in a separate "Architecture Change Proposals" note — **never implemented directly**. A proposal is only adopted once this document is explicitly updated and re-approved. This keeps one authoritative version of the truth instead of the design slowly drifting from what's written here to whatever ended up in the codebase.

---

## §2. Document Purpose & How to Use This Document

This is the single source of truth for QuoteFlow's authentication system. It is written so that a different engineer — or a future version of you, six months from now, starting the next vertical re-skin — could implement Phase 3 end-to-end without re-deriving any of these decisions.

It assumes the database schema described in the existing project context (`Organization`, `User`, PostgreSQL native UUIDs, `Role`, `isActive`, `passwordHash`, multi-tenant scoping) and treats that schema as **frozen** independently of this document's own freeze (it was already frozen at the end of Phase 2.1). Every decision below fits that schema; none of them change it. Exact field-name verification is a mechanical pre-implementation step, not an open architectural question — see §27.

No application code is included in this document. Folder trees, environment variable names, and flow diagrams are structural references for implementation to follow, not implementation itself.

---

## §3. Context Recap

**Confirmed stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma, Neon PostgreSQL, TanStack Query, Tailwind v4, shadcn/ui, Zod, Vitest.

**Confirmed schema primitives (frozen since Phase 2.1):**
- `Organization` — the tenant. Every other business record is scoped to one.
- `User` — belongs to an `Organization`, has a `Role`, an `isActive` flag, and a `passwordHash`.
- Native PostgreSQL UUIDs as primary keys (not `cuid()`).
- Multi-tenant architecture — the same deployed application is capable of serving more than one `Organization`.

**Business-model implication (shapes §12 and §14):** QuoteFlow is simultaneously (a) a multi-tenant-*capable* codebase per the Universal Internal Tool Blueprint, and (b) in practice delivered as a single-organization instance per paying client. The bootstrap and registration design accounts for both modes without a code fork.

---

## §4. Authentication Strategy

### 4.1 Options evaluated

| Option | Verdict for QuoteFlow now | Reasoning |
|---|---|---|
| **Credentials (email + password)** | **Selected** | Zero external dependency, zero cost, full control over the `User`/`Organization` model, works identically in local dev and production, and matches every client persona's mental model. |
| **OAuth (Google/Microsoft)** | Deferred, designed for | Real value once a client's staff already live in Google Workspace or Microsoft 365. Zero structural cost to add later (§18). Not worth the added complexity at MVP/portfolio stage. |
| **Magic links / passwordless email** | Deferred | Requires transactional email (Resend), which is deferred per the zero-cost build plan until a real client justifies the cost. |
| **SSO (SAML/OIDC enterprise)** | Out of scope | Only relevant at the Enterprise package tier. Architected for, not built. |

### 4.2 Why Credentials is the right choice for this phase

1. **Cost:** $0 — no third-party auth provider, no per-MAU pricing, no email-sending dependency.
2. **Control:** the `Organization`/`User`/`Role` model already encodes everything Credentials auth needs; no schema change required.
3. **Portfolio narrative:** a clean, correct Credentials flow is itself a competence signal in client demos.
4. **Forward compatibility:** Auth.js treats Credentials and OAuth providers as peers under one session/JWT/middleware pipeline. Adding a second provider later is additive, not a rewrite (§18).

---

## §5. High-Level Authentication Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Browser / Client                         │
│   Login form → Server Action → Auth.js Credentials Provider         │
└───────────────────────────────┬───────────────────────────────────--┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Auth.js Core (lib/auth.ts)                  │
│  Credentials Provider → verify(email, password) → Prisma lookup     │
│  JWT callback (embed userId, orgId, role, isActive)                  │
│  Session callback (project JWT claims onto session object)           │
└───────────────────────────────┬───────────────────────────────────--┘
                                 │  signed, httpOnly session cookie
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          middleware.ts                               │
│  Reads session token → classifies route (public/guest-only/protected)│
│  → enforces role-based route access → redirects or allows            │
└───────────────────────────────┬───────────────────────────────────--┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  App Router pages / Server Actions                  │
│  Every Server Action independently re-checks session + org scope     │
│  (defense in depth — never trusts middleware alone)                  │
└───────────────────────────────────────────────────────────────────--┘
```

**Core principle carried through the whole design:** authorization is checked at *every* layer that can be reached independently — middleware for routes, server actions for mutations, query layers for reads — because each of these can, in principle, be invoked without passing through the others.

---

## §6. Detailed Flows

### 6.1 Login Flow
```
1. User submits email + password via the login form
2. Form calls a Server Action (NOT a client-side fetch to an API route)
3. Server Action delegates to Auth.js signIn("credentials", { email, password })
4. Auth.js Credentials Provider's `authorize()`:
     a. Look up User by email (case-insensitive) — also fetch Organization + Role + isActive
     b. If no user found → return null (generic failure, see §15 user-enumeration note)
     c. If user.isActive === false → return null (generic failure — do not reveal "account disabled")
     d. Compare submitted password against passwordHash using bcrypt.compare
     e. If mismatch → return null
     f. If match → return a minimal user object: { id, organizationId, role, name, email }
5. Auth.js JWT callback fires → embeds id, organizationId, role into the token
6. Auth.js Session callback fires → projects those claims onto session.user
7. Signed JWT written to an httpOnly, Secure, SameSite=Lax cookie
8. Server Action redirects to /dashboard (or returns a field-level error)
```

### 6.2 Logout Flow
```
1. User triggers logout (button → Server Action → Auth.js signOut())
2. Auth.js clears the session cookie (sets it expired/empty)
3. Redirect to /login
4. No server-side session record to invalidate (JWT strategy — see §8.1)
```

### 6.3 Session Lifecycle
```
Issued at login → stored client-side as an encrypted JWT in an httpOnly cookie
   → read on every request by middleware and by `auth()` calls in Server Components/Actions
   → silently re-signed/extended on activity (rolling session, §8.3)
   → expires after MAX_AGE of inactivity OR absolute lifetime, whichever comes first
   → on expiry, next request is treated as unauthenticated → redirected to /login?reason=expired
```

### 6.4 Authorization Flow (per request)
```
Request arrives
   → middleware decodes session (if present)
   → middleware checks: is this route public / guest-only / protected?
   → if protected: is there a valid session? → if not, redirect to /login
   → if protected: does session.role satisfy the route's minimum role? → if not, redirect with the
     approved insufficient-role pattern (§11.3)
   → request proceeds to the page/Server Component
   → page/Server Component calls requireSession() again (defense in depth) before rendering sensitive data
   → any Server Action invoked from that page re-validates session + organization scope independently
```

### 6.5 Request Lifecycle (where each check lives)
```
Edge:        middleware.ts        → coarse-grained: authenticated? correct role for this route segment?
Server:      Server Component     → requireSession() before querying — query is always organizationId-scoped
Server:      Server Action        → requireSession() + role check + organizationId-scoped write
Database:    Prisma query         → never trusts a caller-supplied organizationId; always derives it from session
```

### 6.6 Middleware Flow
Full design in §11; summarized here:
```
Incoming request
   → Is path in PUBLIC_ROUTES? → allow, no session check
   → Is path in GUEST_ONLY_ROUTES (login/register)? → if session exists, redirect to /dashboard; else allow
   → Otherwise (protected): require valid session
        → no session → redirect /login?callbackUrl=<original>
        → session exists but isActive === false → force logout, redirect /login?reason=deactivated
        → session exists, role insufficient for this segment → approved insufficient-role pattern (§11.3)
        → else → allow, attach session info to request headers for downstream use
```

### 6.7 Route Protection Flow (example)
```
/dashboard           → protected, any authenticated role
/reports             → protected, role in [OWNER, OFFICE_MANAGER]
/settings/team       → protected, role === OWNER only
/jobs/mobile          → protected, role === TECHNICIAN (and others, per the access map)
/login, /register     → guest-only
/setup                → guest-only AND only reachable while Organization.count() === 0 (§12)
/api/lead-capture     → public, unauthenticated, but rate-limited
```

### 6.8 User Lifecycle
```
Created  → via Bootstrap (first user, §12) or via an Owner creating a teammate in Settings (§9.5)
Active   → isActive = true, can log in, subject to role-based access
Deactivated → isActive = false, set by an Owner (never self-service) — existing sessions for that
              user must be treated as invalid on next sensitive operation (§7.6)
Reactivated → Owner flips isActive back to true; password is unchanged
Deleted  → not a hard delete in Phase 3 — deactivation is the supported path
```

### 6.9 Bootstrap Flow
Covered in full in §12.

### 6.10 Password Lifecycle
```
Set        → at user creation (Bootstrap or Owner-created teammate, §9.5)
Changed    → authenticated user, from Settings → Account, must re-enter current password (§9.4)
Reset      → Phase 3: manual, Owner/developer updates passwordHash directly (§9.6)
             Future: self-service email-based reset (§18) — not built in Phase 3
Compared   → always via bcrypt.compare — never via direct string equality
```

---

## §7. Auth.js Design

### 7.1 Providers
Phase 3 ships **one** provider: Credentials. Designed-for, not built: Google/Microsoft OAuth (§18).

### 7.2 Session strategy
**JWT strategy**, not database sessions. Justification in §8.1.

### 7.3 JWT callback — responsibilities
- On initial sign-in: copy `id`, `organizationId`, `role`, `isActive`, `name` from the authorized user object onto the token.
- On every subsequent request: do not re-query the database by default.
- The token must never carry `passwordHash` or any other sensitive field.

### 7.4 Session callback — responsibilities
Project the token's claims onto `session.user` so Server Components and Server Actions can read `session.user.organizationId` and `session.user.role` directly.

### 7.5 Authorized callback (middleware integration)
Used by `middleware.ts` to enforce the Route Protection Flow (§6.7). This callback is purely about routing decisions — never business logic, which belongs in Server Actions per §21.

### 7.6 The "stale claim" problem and its resolution (approved)
Two mitigations, **both required**:
1. **7-day absolute session lifetime with rolling renewal** (§8.3) bounds the staleness window.
2. **Re-query `isActive`/`role` from the database inside Server Actions that perform sensitive writes** (team/role management, settings, financial-adjacent operations) rather than on every page load — closing the gap for writes that matter while keeping JWT's performance benefit for reads.

---

## §8. Session Architecture

### 8.1 JWT vs. Database Sessions — Decision: JWT (approved, frozen)
| Factor | JWT | Database Sessions |
|---|---|---|
| Infra cost | None | An extra table + a write on every session refresh |
| Latency | No DB round-trip to validate a session | DB round-trip on every authenticated request |
| Revocation | Harder (mitigated in §7.6) | Instant (delete the row) |
| Fit for this project | **Better** | Better suited to apps with a hard "revoke instantly" requirement |

Revisit only if a real client's compliance requirements demand instant, guaranteed revocation (§1 — business requirement change).

### 8.2 Cookie strategy (approved, frozen)
- `httpOnly` — not readable by client-side JavaScript.
- `Secure` — cookie only sent over HTTPS.
- `SameSite=Lax` — sent on top-level navigation, not on cross-site form posts/iframes.

### 8.3 Token lifetime & refresh (approved, frozen)
- **Absolute max age: 7 days.** This is the approved default for Phase 3. Changing it requires a documented justification per §1 (e.g., a client in a security-sensitive vertical).
- **Rolling/idle renewal** is enabled: an actively-working user is never interrupted mid-day; an idle session still expires.
- **"Remember me"** is explicitly **out of scope for Phase 3** — candidate for a later, additive enhancement (§18), not a Phase 3 deliverable.

### 8.4 Session invalidation & logout behavior
Logout clears the cookie client-side. There is no server-side session record to delete (JWT strategy). Accepted tradeoff, mitigated by §7.6.

### 8.5 Multi-device behavior
Each device/browser gets its own independent JWT cookie. No "log out everywhere" control in Phase 3 — out of scope, candidate for §18.

---

## §9. Password Security

### 9.1 Hashing algorithm
**bcrypt**, cost factor 12 by default, externalized as `BCRYPT_COST_FACTOR` (§14) so it can be tuned without a code change.

### 9.2 Salt strategy
bcrypt generates and stores its own per-password salt as part of the hash output. No separate salt column.

### 9.3 Password validation policy (approved, frozen)
- Minimum 10 characters. Favor length over forced complexity rules.
- No forced periodic rotation.
- Lightweight denylist check against a small set of trivially common passwords (`password`, `12345678`, the organization name, etc.) via a Zod refinement, shared client + server.

### 9.4 Password change flow (authenticated user)
```
1. User navigates to Settings → Account
2. Submits current password + new password + confirmation
3. Server Action re-verifies current password via bcrypt.compare against the stored hash
4. New password validated against policy (§9.3)
5. New hash computed and saved; old hash discarded entirely (no password history table in Phase 3)
```

### 9.5 Owner-creates-teammate flow
```
1. Owner adds a teammate in Settings → Team (name, email, role)
2. System generates a random temporary password and displays it once, on-screen, to the Owner,
   with a clear "copy this now, it won't be shown again" warning
3. Owner relays it to the teammate out-of-band
4. Teammate logs in with the temporary password and is forced to set a new one before reaching
   the dashboard (a "must change password" flag on the User record)
```

### 9.6 Password reset architecture
- **Phase 3 (approved):** manual reset only — the developer/Owner updates the affected `User.passwordHash` through a small authenticated admin action, consistent with the zero-cost build plan's existing posture.
- **Future, not built in Phase 3 (§18):** a `PasswordResetToken` table and self-service email-based reset flow, dropped in additively once Resend is adopted.

### 9.7 Timing attack protection & secure comparison
`bcrypt.compare` is constant-time by design. Flow-level timing leakage is closed by always running a (dummy or real) bcrypt comparison on the login path even when the email isn't found, rather than short-circuiting on a failed lookup.

---

## §10. Authorization

### 10.1 Role-based access (roles, per frozen schema)
| Role | Scope |
|---|---|
| `OWNER` | Full access within their Organization: all records, reports, settings, billing, team/role management |
| `OFFICE_MANAGER` | Leads, quotes, scheduling — no financial/owner-level reports, no role management |
| `SALES_REP` | Own leads/quotes only (record-level, not just route-level) |
| `TECHNICIAN` | Assigned jobs only, mobile-optimized read/update view |

### 10.2 Permission model (approved for Phase 3)
Role-based, not a granular permission table. A role implies a fixed bundle of allowed routes + allowed record scopes (above). A permission-table model is an explicitly deferred future step (§18), not a Phase 3 requirement.

### 10.3 Where authorization checks belong (defense in depth)
1. **Middleware:** coarse route-level gate.
2. **Server Actions:** the real enforcement point — every action re-derives the session, re-checks role, and scopes every query/write by `organizationId` (and, for `SALES_REP`/`TECHNICIAN`, additionally by ownership).
3. **UI:** hide/disable controls as a courtesy only — never a security boundary.

### 10.4 Record-level scoping rule (mandatory, see §21)
Every database read/write inside a Server Action must be scoped by the session's `organizationId` and, for roles narrower than `OFFICE_MANAGER`/`OWNER`, additionally by ownership (`assignedToId === session.user.id` for a `SALES_REP`; `technicianId === session.user.id` for a `TECHNICIAN`). This must be enforced in the database query itself, never as UI-side filtering of an over-fetched result set.

---

## §11. Middleware Architecture

### 11.1 Responsibilities
`middleware.ts` is the single, central place that classifies every incoming request and enforces the corresponding rule (§6.6–6.7).

### 11.2 Route classification (single exported map — `lib/auth-routes.ts`)
| Bucket | Examples | Rule |
|---|---|---|
| **Public** | `/api/lead-capture`, static assets | No session check at all |
| **Guest-only** | `/login`, `/register` | If a valid session exists, redirect to `/dashboard`; otherwise allow |
| **Guest-only + bootstrap-gated** | `/setup` | Same as guest-only, **plus** unconditionally 404s once `Organization.count() > 0` (§12) |
| **Protected** | `/dashboard`, `/leads/*`, `/quotes/*`, `/jobs/*`, `/customers/*`, `/reports/*`, `/settings/*` | Require valid session; further gate by role per §10.1 |

### 11.3 Redirect strategy (approved, frozen)
- Unauthenticated access to a protected route → `/login?callbackUrl=<originally requested path>`.
- **Insufficient role (approved pattern): redirect to `/dashboard` with a toast** ("You don't have access to that page"). A hard `/403` page is explicitly **not** used in Phase 3 — this decision is final; do not reintroduce a 403 page without a documented reason per §1.
- Deactivated user with a still-valid JWT → force logout (clear cookie), redirect to `/login?reason=deactivated`.

### 11.4 What middleware deliberately does not do
- No record-level scoping (§10.4) — that's a Server Action responsibility.
- No database query beyond decoding the JWT.

---

## §12. Bootstrap Flow

### 12.1 The problem
On a brand-new deployment, `Organization` and `User` are both empty. Something must create the first `Organization` and the first `OWNER` user, before any authentication exists to protect that action.

### 12.2 Options considered

| Approach | Description |
|---|---|
| A. Public self-registration, always on | Anyone hitting `/register` can create a new Organization + Owner at any time |
| B. Seed script (`prisma db seed`) | Existing demo-data mechanism |
| **C. One-time setup wizard** | A `/setup` page reachable only while `Organization.count() === 0`; permanently inert afterward |
| D. Admin CLI script | A script run once directly against the production database connection |
| E. Env-var-triggered auto-bootstrap on boot | Rejected — plaintext credentials in env vars, easy to leave enabled |

### 12.3 Decision

> ### ✅ Recommended and Approved for Phase 3: **Option C — One-Time Setup Wizard**

**Phase 3 implements only Option C**, plus the registration-flag policy below. Option C is approved because:
- It requires no server/CLI access — the developer can complete it live, on a screen-share, during client onboarding.
- It is self-gating by construction (`Organization.count() === 0`), so there is no separate "remember to disable this" step — once the first Organization exists, the route is permanently inert with no manual cleanup required.
- It reuses the existing login session-issuance pipeline (§6.1, steps 5–8) rather than introducing a parallel code path.

**Option B (seed script)** remains in use, unchanged, for local development and the public portfolio/demo instance — it is not a Phase 3 deliverable, it already exists.

**Option D (admin CLI script)** is **explicitly deferred** and documented only as a future alternative (§18) — it is **not built in Phase 3**. If a future situation arises where the setup wizard is somehow unusable (e.g., provisioning a second, fully separate Organization on a shared deployment), Option D should be designed and approved as a deliberate addition at that time, not improvised during an incident.

**Option A (public self-registration)** ships as a route, gated by the `ALLOW_PUBLIC_REGISTRATION` environment flag, **defaulted to `false`**. It is enabled only on the public-facing portfolio/demo deployment. Every real client deployment ships with it `false`. This is an approved, frozen default (§1) — flip it only with a documented reason.

### 12.4 Bootstrap sequence (the only sequence Phase 3 implements)
```
1. Deployment goes live with an empty database (post `migrate deploy`)
2. Visiting any protected route, or "/", redirects to /setup automatically
   IF AND ONLY IF Organization count === 0 — otherwise /setup 404s
3. /setup presents one form: Organization name, Owner name, Owner email, Owner password
4. Submission: validate input → hash password (§9.1) → create Organization and User
   (role = OWNER, isActive = true) in a single transaction
5. Immediately sign the new Owner in (reuse the login flow's session issuance, §6.1 steps 5-8)
6. Redirect to /dashboard
7. /setup is now permanently inert for this deployment (Organization count > 0)
```

---

## §13. File & Folder Structure

```
quoteflow/
├── middleware.ts                          # route classification + auth/role gate (§11)
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx             # login form (guest-only route)
│   │   │   ├── register/page.tsx          # public registration (flag-gated, §12.3)
│   │   │   └── setup/page.tsx             # one-time bootstrap wizard (§12.4)
│   │   ├── (dashboard)/
│   │   │   └── settings/
│   │   │       ├── account/page.tsx       # password change (§9.4)
│   │   │       └── team/page.tsx          # Owner-creates-teammate flow (§9.5)
│   │   └── api/
│   │       └── auth/[...nextauth]/route.ts   # Auth.js route handler (handlers export)
│   ├── features/
│   │   └── auth/
│   │       ├── actions.ts                 # signIn/signOut/changePassword/createTeammate/bootstrap Server Actions
│   │       ├── schema.ts                  # Zod schemas: login, register, setup, change-password
│   │       ├── queries.ts                 # requireSession(), getCurrentUser() helpers
│   │       └── types.ts                   # SessionUser, Role enum mirror, etc.
│   ├── lib/
│   │   ├── auth.ts                        # Auth.js config: providers, callbacks, session strategy
│   │   ├── auth-routes.ts                 # the public/guest-only/protected route map (§11.2)
│   │   ├── password.ts                    # hash/compare wrapper around bcrypt
│   │   ├── audit-log.ts                   # auth-event logging helper (§15)
│   │   └── db.ts                          # existing Prisma client singleton — unchanged
│   └── components/
│       └── auth/
│           ├── LoginForm.tsx
│           ├── SetupWizardForm.tsx
│           └── ChangePasswordForm.tsx
```

No `app/403/page.tsx` — explicitly not built, per the approved redirect strategy in §11.3.

---

## §14. Environment Variables

| Variable | Required | Environment | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | Dev + Prod | Existing Neon connection string — unchanged |
| `AUTH_SECRET` | Yes | Dev + Prod | Signs/encrypts the JWT session cookie. Unique per environment — never shared |
| `NEXT_PUBLIC_APP_URL` | Yes | Dev + Prod | Existing — used for absolute callback URLs |
| `ALLOW_PUBLIC_REGISTRATION` | Yes (new) | Dev + Prod | **Defaults to `false`.** Set `true` only on the public portfolio/demo deployment (§12.3) |
| `BCRYPT_COST_FACTOR` | No (new, optional) | Dev + Prod | Defaults to `12` if unset |

**Secret management:** `.env` remains git-ignored. `AUTH_SECRET` is set directly in the hosting dashboard for each environment, never committed, never reused across deployments.

---

## §15. Security Architecture

| Concern | Mitigation |
|---|---|
| **CSRF** | Auth.js's built-in CSRF protection on its own endpoints; Server Actions are inherently more CSRF-resistant than form posts to API routes |
| **XSS** | `httpOnly` cookies (§8.2); standard React output escaping; no `dangerouslySetInnerHTML` near user-supplied content |
| **Session hijacking** | `Secure` + `httpOnly` + `SameSite=Lax` (§8.2); HTTPS-only in production |
| **Cookie security** | §8.2 — no sensitive data in any non-httpOnly cookie or in localStorage |
| **Secure headers** | `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a reasonably strict `Content-Security-Policy` |
| **HTTPS requirement** | Provided by the hosting platform; never disable the `Secure` cookie flag |
| **Brute-force protection** | Per-email + per-IP rate limit on the login Server Action (5 attempts / 15 minutes) |
| **Account lockout strategy** | Progressive delay, not a hard lockout (avoids a lockout-as-denial-of-service vector) |
| **User enumeration prevention** | Identical failure messaging for unknown email, wrong password, and deactivated account: "Invalid email or password," always |
| **Timing attacks** | §9.7 |
| **Logging** | Log auth events (login success/failure, logout, password change, role change, deactivation) with timestamp, userId, organizationId, IP — never log password/hash material |
| **Audit considerations** | Business-facing events go in the existing `Activity` table; raw auth-attempt logs are a separate, lower-level concern via `lib/audit-log.ts` |
| **Secret rotation** | `AUTH_SECRET` rotation invalidates all sessions instantly — an acceptable emergency "log everyone out" lever |
| **General best practices** | Least privilege (§10.1); defense in depth (§10.3); fail closed on any ambiguous auth state |

---

## §16. Error Handling

| Scenario | Handling |
|---|---|
| Invalid login credentials | Generic "Invalid email or password" — no distinction by cause (§15) |
| Auth.js internal error | Logged server-side with detail; user sees a generic retry message |
| Authorization failure (wrong role) | Toast-on-dashboard pattern (§11.3) |
| Expired session | Treated as no session; one-line banner on `/login?reason=expired` |
| Malformed/tampered session token | Treated as no session (fail closed) |
| Database failure during auth | Caught at the Server Action boundary; generic retry message to the user, full detail logged |
| Token/cookie tampering | JWT signature verification fails → treated as no session |

---

## §17. UI/UX Flow

- **Login page:** single email + password form, inline (non-disappearing) error region, and an honest "Forgot password?" note pointing to the Phase 3 manual-reset reality (§9.6).
- **Logout:** a single, obvious action in the topbar/user menu; immediate redirect, no confirmation modal.
- **Loading states:** login button shows a disabled/spinner state during submission — no double-submit.
- **Error states:** field-level Zod validation appears inline before the Server Action is even called for obviously-invalid input; server-side errors appear in the same region after the round trip.
- **Expired session handling:** one-line banner on the login page (§16).
- **Redirect experience:** `callbackUrl` (§11.3) returns the user to where they were headed after login.
- **Insufficient-role experience:** toast-on-dashboard (§11.3) — approved, final.

---

## §18. Future Expansion (Documented Alternatives — Not Implemented in Phase 3)

This architecture is built so each item below is an **addition**, not a restructure. None of these are Phase 3 deliverables; they are recorded here precisely so they are never silently implemented mid-phase without a documented decision (§1).

| Future item | Why it slots in cleanly later |
|---|---|
| **Admin CLI bootstrap script (Option D, §12.2)** | A deliberate future addition if the setup wizard ever proves insufficient (e.g., provisioning a second Organization on a shared deployment) |
| **Google / Microsoft OAuth** | Added to the same `providers` array in `lib/auth.ts`; the callback shape (§7.3–7.4) is already provider-agnostic |
| **Magic links** | A new provider type; reuses the same session/JWT/middleware pipeline; needs Resend |
| **MFA / 2FA** | Adds a verification step inside or after `authorize()`; doesn't change session, middleware, or role model |
| **Passkeys (WebAuthn)** | Another Auth.js provider type; same downstream pipeline |
| **SSO (SAML/OIDC)** | Another provider type, relevant at the Enterprise tier |
| **Email verification** | An additive `emailVerifiedAt` field plus a token table analogous to §9.6 |
| **Self-service password reset** | §9.6 — designed, just needs Resend |
| **Invitations** | Extends §9.5 — replace the on-screen temporary password with an emailed invite token |
| **Granular permission table** | Replaces the §10.2 fixed role bundles once a client needs custom roles |
| **"Log out everywhere"** | Requires moving toward database-backed session tracking for this one feature only |
| **"Remember me"** | An additive longer-lived cookie option at login |
| **Hard `/403` page** | Could replace the toast-on-dashboard pattern if a future requirement demands it — not adopted now |
| **Multiple organizations per user** | Would require a join table instead of `User.organizationId` being a direct field — the one item here that *would* touch the frozen database schema; only pursue on a real business requirement |
| **Hosted SaaS deployment (many orgs, self-service)** | Already supported by `ALLOW_PUBLIC_REGISTRATION=true` (§12.3) plus existing multi-tenant scoping — a deployment-configuration change, not an architecture change |

---

## §19. Testing Strategy

| Layer | Tool | Covers |
|---|---|---|
| **Unit** | Vitest | Password hashing/comparison wrapper; role → allowed-routes map logic; Zod schemas (login, setup, change-password) |
| **Integration** | Vitest + Prisma test DB | Full login flow (success + wrong password + deactivated account, asserting identical error shape); bootstrap flow creating exactly one Organization + Owner; password change rejecting an incorrect "current password" |
| **Middleware** | Vitest (request mocking) | Each route bucket (§11.2) redirects/allows correctly for each role and for no session |
| **Authorization** | Vitest + Prisma test DB | A `SALES_REP` querying leads only ever receives their own; a direct Server Action call as the wrong role is rejected |
| **Security** | Manual + scripted | Comparable timing for "unknown email" vs. "wrong password"; rate limiting triggers at threshold; a tampered/expired JWT is treated as unauthenticated |
| **E2E** | Playwright | Empty deployment → `/setup` → bootstrap → dashboard → logout → login → role-restricted page as a lower role → confirm toast-redirect |

**Mandatory edge-case tests:**
- Logging out in one tab does not retroactively invalidate a session already in use in another tab on its current request (only on its next one) — confirms the documented §8.4 tradeoff, not a bug.
- An Owner cannot deactivate the last remaining Owner-eligible user, including themselves.
- `/setup` 404s on a second visit after bootstrap has occurred, regardless of session state.
- Registration is blocked server-side (not just hidden in the UI) when `ALLOW_PUBLIC_REGISTRATION=false`.

---

## §20. Risks

| Risk | Category | Mitigation |
|---|---|---|
| JWT staleness lets a just-deactivated user act briefly | Security | §7.6 |
| Bootstrap route left reachable in a misconfigured deployment | Security | Hard-gate on `Organization.count() === 0`, tested explicitly (§19) |
| `ALLOW_PUBLIC_REGISTRATION` accidentally left `true` on a client deployment | Security / Operational | Default `false`; documented in the deployment checklist for every client handoff |
| bcrypt cost factor becomes outdated as hardware improves | Security (long-term) | Externalized as `BCRYPT_COST_FACTOR` (§14) |
| No instant session revocation (JWT tradeoff) | Security | Accepted (§8.1); `AUTH_SECRET` rotation as an emergency lever |
| Manual password reset doesn't scale past a handful of accounts | Operational | Explicitly scoped to dev/demo accounts; §9.6 is the documented upgrade path |
| Fixed-enum role model, not a permission table | Scalability | Acceptable now (§10.2); flagged in §18 as the right next step when needed |
| Single-org-per-User schema can't represent a multi-org consultant use case | Scalability | Flagged in §18; not a Phase 3 requirement |

---

## §21. Implementation Standards

These rules are mandatory for every line of code written in Phase 3. They are not stylistic suggestions — code review should treat a violation of any of these as a blocking issue.

1. **Server Actions only for authentication logic.** No authentication or authorization decision is made in a Client Component, an API route handler (other than the one Auth.js handler itself), or middleware-adjacent helper outside of `lib/auth.ts` / `lib/auth-routes.ts`.
2. **No business logic inside React components.** Components render and dispatch; they do not contain validation rules, authorization rules, or data-shaping logic beyond simple presentation formatting.
3. **No direct Prisma access from UI components.** All database access happens in Server Actions or query functions under `features/auth/` (or other feature folders) — never imported directly into a `.tsx` component.
4. **All input validated using Zod.** Every Server Action accepting user input parses it through a Zod schema before doing anything else with it — no exceptions, even for "obviously safe" internal calls.
5. **Every protected operation must verify authentication.** Every Server Action that isn't explicitly public calls `requireSession()` (or equivalent) as its first line, before any other logic.
6. **Every database query must be tenant-scoped.** Every query and mutation includes an `organizationId` filter derived from the session — never from client input, never omitted "because it's probably fine."
7. **Authorization checks must exist on the server.** UI-level hiding of a control is a courtesy, never a substitute for a server-side role/ownership check (§10.3).
8. **One responsibility per file.** `lib/auth.ts` configures Auth.js and nothing else; `lib/password.ts` only hashes/compares; `features/auth/actions.ts` only contains Server Actions, not helper utilities that belong in `queries.ts` or `lib/`.
9. **Keep implementation modular.** Reusable logic (e.g., `requireSession()`) is written once and imported everywhere it's needed — never copy-pasted between feature modules.
10. **Follow Feature-Sliced Design consistently.** `app/` stays thin and routing-only; `features/auth/` owns the vertical slice; `lib/` stays limited to true infrastructure singletons — matching the convention already established in Phases 1–2.
11. **No unnecessary package additions.** Only the packages explicitly named in §22 are installed for Phase 3. Anything else requires this document to be amended first.
12. **No version upgrades unrelated to Phase 3.** Existing dependencies (Next.js, React, Prisma, Tailwind, etc.) are not bumped as a side effect of this phase, even if a newer version is available.

---

## §22. Dependency Policy

- **Do not upgrade existing packages.** The current versions of Next.js, React, Prisma, Tailwind, shadcn/ui, Zod, TanStack Query, and Vitest are treated as fixed for the duration of Phase 3.
- **Do not replace approved libraries.** Auth.js and bcrypt (or `bcryptjs`, per the existing zero-cost build plan) are the approved choices; do not substitute a different auth library or hashing library mid-implementation.
- **Only install packages explicitly required for authentication.** For Phase 3, that means: Auth.js (`next-auth`), a bcrypt implementation, and their direct TypeScript type packages if needed. Nothing else.
- **Keep dependencies minimal.** If a small piece of functionality (e.g., a rate-limit counter) can be built with what's already installed plus a few lines of code, do that instead of pulling in a new package.
- **Maintain compatibility with the existing project architecture.** Any new file fits into the structure in §13 and the conventions in §21 — it does not introduce a parallel pattern (e.g., a separate API-route-based auth flow alongside the Server Action approach) "just for this one feature."

---

## §23. File Responsibility Matrix

| Path | Purpose | Responsibility | Depends on | Used by |
|---|---|---|---|---|
| `middleware.ts` | Edge-level route gate | Classify request via `lib/auth-routes.ts`; allow/redirect per §11 | `lib/auth.ts`, `lib/auth-routes.ts` | Every incoming request |
| `lib/auth.ts` | Auth.js configuration | Providers, JWT callback, session callback, authorized callback (§7) | `lib/db.ts`, `lib/password.ts`, Prisma `User`/`Organization` models | `middleware.ts`, `app/api/auth/[...nextauth]/route.ts`, `features/auth/actions.ts`, `features/auth/queries.ts` |
| `lib/auth-routes.ts` | Route classification map | Defines public / guest-only / bootstrap-gated / protected buckets and per-route minimum role (§11.2) | None | `middleware.ts` |
| `lib/password.ts` | Password hashing/comparison | Single source of truth for bcrypt cost factor, hash, and compare (§9.1) | `BCRYPT_COST_FACTOR` env var | `lib/auth.ts`, `features/auth/actions.ts` |
| `lib/audit-log.ts` | Auth-event logging | Writes structured auth event logs per §15 (never logs password material) | `lib/db.ts` (if persisted) or structured console output | `features/auth/actions.ts` |
| `lib/db.ts` | Prisma client singleton | Unchanged from Phase 1/2 | — | Everything that touches the database |
| `app/api/auth/[...nextauth]/route.ts` | Auth.js HTTP handler | Exposes Auth.js's `handlers` (GET/POST) | `lib/auth.ts` | Browser session requests Auth.js itself manages |
| `app/(auth)/login/page.tsx` | Login screen | Renders `LoginForm`; guest-only route | `components/auth/LoginForm.tsx` | End users |
| `app/(auth)/register/page.tsx` | Public registration screen | Renders only when `ALLOW_PUBLIC_REGISTRATION=true`; otherwise inert per §12.3 | `features/auth/actions.ts`, `features/auth/schema.ts` | Public/demo deployment only |
| `app/(auth)/setup/page.tsx` | Bootstrap wizard | Renders `SetupWizardForm`; guest-only + bootstrap-gated (§12.4) | `components/auth/SetupWizardForm.tsx`, `features/auth/actions.ts` | First-run deployments |
| `app/(dashboard)/settings/account/page.tsx` | Password change screen | Renders `ChangePasswordForm` (§9.4) | `components/auth/ChangePasswordForm.tsx`, `features/auth/actions.ts` | Any authenticated user |
| `app/(dashboard)/settings/team/page.tsx` | Teammate creation/management | Owner-only; triggers §9.5 flow | `features/auth/actions.ts`, `features/auth/queries.ts` | `OWNER` role only |
| `features/auth/actions.ts` | All authentication Server Actions | `signIn`, `signOut`, `changePassword`, `createTeammate`, `bootstrapOrganization` — each starts with validation + auth check per §21 | `lib/auth.ts`, `lib/password.ts`, `lib/audit-log.ts`, `features/auth/schema.ts`, `lib/db.ts` | All `app/(auth)/*` and `app/(dashboard)/settings/*` pages |
| `features/auth/schema.ts` | Zod schemas | `loginSchema`, `setupSchema`, `registerSchema`, `changePasswordSchema`, `createTeammateSchema` | Zod | `features/auth/actions.ts`, corresponding form components |
| `features/auth/queries.ts` | Session/auth helper functions | `requireSession()`, `getCurrentUser()`, role-check helpers (§10.3) | `lib/auth.ts` | Every other feature module's Server Actions (leads, quotes, jobs, customers, reports, settings) |
| `features/auth/types.ts` | Shared auth types | `SessionUser` shape, `Role` mirror type | Prisma-generated types | `features/auth/actions.ts`, `features/auth/queries.ts`, component props |
| `components/auth/LoginForm.tsx` | Login UI | Client Component; calls `signIn` Server Action; inline validation/error display (§17) | `features/auth/schema.ts` (client-side parse) | `app/(auth)/login/page.tsx` |
| `components/auth/SetupWizardForm.tsx` | Bootstrap UI | Client Component; calls `bootstrapOrganization` Server Action | `features/auth/schema.ts` | `app/(auth)/setup/page.tsx` |
| `components/auth/ChangePasswordForm.tsx` | Password change UI | Client Component; calls `changePassword` Server Action | `features/auth/schema.ts` | `app/(dashboard)/settings/account/page.tsx` |
| `.env.example` | Documents required env vars | Updated to include `ALLOW_PUBLIC_REGISTRATION`, `BCRYPT_COST_FACTOR` (§14) | — | New contributors, deployment setup |
| `README.md` | Project documentation | Updated "Getting Started" to mention `/setup` bootstrap; env var table updated | — | New contributors, future-you re-skinning the codebase |

---

## §24. Phase 3 Implementation Roadmap

Each step assumes the previous step is merged to `main` first, per the existing one-branch-per-feature, PR-and-squash-merge workflow. Step 0 is a mechanical verification pass, not architecture work.

### Step 0 — Pre-implementation verification
- **Objective:** Confirm the mechanical assumptions in §27 against the live, hardened schema before writing any auth code.
- **Files affected:** None (read-only verification against `prisma/schema.prisma`).
- **Dependencies:** None.
- **Expected output:** A short confirmation (or a documented mapping note, if any field name differs from §27's assumptions) before Step 1 begins.
- **Verification checklist:** Every item in §27 checked off.
- **Completion criteria:** No open mechanical unknowns remain.

### Step 1 — Auth.js core configuration
- **Objective:** Stand up `lib/auth.ts` with the Credentials provider, JWT strategy, and callbacks (§7).
- **Files affected:** `lib/auth.ts`, `lib/password.ts`, `app/api/auth/[...nextauth]/route.ts`
- **Dependencies:** Step 0; install Auth.js + bcrypt per §22.
- **Expected output:** A working `authorize()` function that correctly accepts/rejects against the existing `User` table, no UI yet.
- **Verification checklist:** Correct user logs in (token issued); wrong password rejected; deactivated user rejected with the same generic failure and comparable timing (§9.7).
- **Completion criteria:** All three cases pass with identical error shape/timing.

### Step 2 — Route map and middleware
- **Objective:** Build `lib/auth-routes.ts` and `middleware.ts` (§11).
- **Files affected:** `middleware.ts`, `lib/auth-routes.ts`
- **Dependencies:** Step 1.
- **Expected output:** Protected routes redirect when unauthenticated; guest-only routes redirect when authenticated.
- **Verification checklist:** Each route bucket (§11.2) tested for every role and for no session.
- **Completion criteria:** Every bucket behaves exactly per §11.2.

### Step 3 — Bootstrap (setup wizard only — §12.3)
- **Objective:** Build `/setup` per §12.4. **Option D (CLI script) is not built in this step or anywhere in Phase 3.**
- **Files affected:** `app/(auth)/setup/page.tsx`, `components/auth/SetupWizardForm.tsx`, bootstrap action in `features/auth/actions.ts`, `features/auth/schema.ts`
- **Dependencies:** Steps 1–2.
- **Expected output:** On an empty database, any route lands on `/setup`; completing it creates the first Organization + Owner and logs them in.
- **Verification checklist:** `/setup` 404s once an Organization exists, tested from a fresh database each time.
- **Completion criteria:** §12.4's sequence passes end-to-end on a clean database, and is blocked correctly on a non-empty one.

### Step 4 — Login & logout UI
- **Objective:** Build the login form and logout control (§17).
- **Files affected:** `app/(auth)/login/page.tsx`, `components/auth/LoginForm.tsx`, logout entry point in the dashboard topbar/user menu
- **Dependencies:** Steps 1–2.
- **Expected output:** A real user can log in and out through the UI.
- **Verification checklist:** Inline validation errors; loading state prevents double-submit; `callbackUrl` round-trip works.
- **Completion criteria:** A non-technical reviewer can complete login/logout without explanation.

### Step 5 — Authorization enforcement in Server Actions
- **Objective:** Implement `requireSession()` in `features/auth/queries.ts` and require it as the first line of every Server Action across every feature module.
- **Files affected:** `features/auth/queries.ts`, plus every `features/<entity>/actions.ts`
- **Dependencies:** Steps 1–2.
- **Expected output:** Every mutation is provably organization-scoped and role-checked, not just route-gated.
- **Verification checklist:** For each role narrower than Owner, a direct Server Action call against an out-of-scope record is rejected.
- **Completion criteria:** No Server Action reads or writes a record without first deriving `organizationId` (and ownership, where applicable) from the session — confirmed by code review against §21, not just happy-path testing.

### Step 6 — Password change & teammate creation
- **Objective:** Build §9.4 and §9.5.
- **Files affected:** `app/(dashboard)/settings/account/page.tsx`, `app/(dashboard)/settings/team/page.tsx`, `components/auth/ChangePasswordForm.tsx`, corresponding Server Actions
- **Dependencies:** Steps 1, 5.
- **Expected output:** Password self-change with current-password re-verification; Owner-created teammates forced to change password on first login.
- **Verification checklist:** Wrong "current password" rejected; non-Owner cannot reach team-creation action even via a direct call.
- **Completion criteria:** Both flows tested for every role boundary.

### Step 7 — Security hardening pass
- **Objective:** Apply §15 in full.
- **Files affected:** Next.js headers config, the login Server Action (rate limiting), `lib/audit-log.ts`
- **Dependencies:** Steps 1–4.
- **Expected output:** Progressive delay on repeated failed logins; auth events logged per §15.
- **Verification checklist:** Scripted rapid-login test confirms delay; log output reviewed for correct fields and absence of password material.
- **Completion criteria:** Every row in §15 has a corresponding implemented control.

### Step 8 — Full test suite
- **Objective:** Implement every test in §19.
- **Files affected:** New test files under each relevant feature module + a `middleware.test.ts`
- **Dependencies:** Steps 1–7.
- **Expected output:** Green CI on the full Phase 3 test suite.
- **Verification checklist:** Every row in §19 and every mandatory edge case has a corresponding test.
- **Completion criteria:** A deliberately-introduced regression (e.g., temporarily removing a `requireSession()` call) causes a test to fail.

### Step 9 — Documentation & handoff
- **Objective:** Update `README.md` and `.env.example` per §13's last two rows.
- **Files affected:** `README.md`, `.env.example`
- **Dependencies:** All prior steps.
- **Expected output:** A new contributor can stand up auth from scratch using only the README.
- **Verification checklist:** Follow the README literally, from a clean clone, with no other context.
- **Completion criteria:** Successful bootstrap + login achieved using only documented steps.

### Branch sequence
```
chore/auth-verify-schema  (Step 0)
feat/auth-core             (Step 1)
feat/auth-middleware       (Step 2)
feat/auth-bootstrap        (Step 3)
feat/auth-ui               (Step 4)
feat/auth-enforcement      (Step 5)
feat/auth-account-team     (Step 6)
feat/auth-hardening        (Step 7)
test/auth-suite            (Step 8)
docs/auth-readme           (Step 9)
```

---

## §25. Definition of Done

Phase 3 is complete only when **all** of the following are true:

- [ ] Authentication works (Credentials login succeeds for a valid, active user).
- [ ] Logout works (session cookie cleared, redirect to `/login`).
- [ ] Session persistence works (JWT survives a page refresh and a new tab; expires per §8.3).
- [ ] Middleware protection works (every route bucket in §11.2 behaves correctly for every role and for no session).
- [ ] Authorization works (role-based route access and record-level scoping, §10, verified for all four roles).
- [ ] Bootstrap setup works (§12.4 sequence passes on a clean database; `/setup` is inert afterward).
- [ ] All validation is complete (every Server Action input is Zod-validated client + server, per §21).
- [ ] Typecheck passes (`tsc --noEmit` clean).
- [ ] Lint passes (existing ESLint config, zero errors).
- [ ] Tests pass (the full §19 suite green in CI).
- [ ] Production build succeeds (`next build` completes without error).
- [ ] No TODOs remain in any Phase 3 file.
- [ ] Documentation is updated (`README.md`, `.env.example` per §13/§24 Step 9).

If any item above is not true, Phase 3 is not done — partial completion is not reported as completion.

---

## §26. Phase Completion Report Template

Implementation must conclude with a structured completion report, in the same format established during Phase 2, containing:

```markdown
# Phase 3 Completion Report — Authentication & Authorization

## Files Created
[list every new file, with a one-line description]

## Files Modified
[list every existing file touched, with a one-line description of the change]

## Packages Installed
[exact package names + versions, cross-checked against §22 — flag anything installed
that wasn't pre-approved, with justification]

## Commands Executed
[migrations, seed runs, test runs, build commands — the actual commands run during implementation]

## Verification Performed
[map each item back to §25's Definition of Done — confirm each checkbox explicitly,
don't just say "all done"]

## Problems Encountered
[anything that didn't go per-plan, and how it was resolved — if it required deviating
from this document, that deviation must be called out explicitly and reconciled with §1]

## Assumptions Made
[anything assumed during implementation that wasn't explicitly pinned down here —
should be rare, since §27 exists precisely to eliminate these before coding starts]

## Security Considerations
[a short narrative confirming §15's controls are actually in place, not just designed]

## Commit Message Recommendation
[a suggested final commit/tag message for this phase, conventional-commits style]

## Next Recommended Phase
[what should logically follow — e.g., Phase 4: Lead Management, per the project's
existing phase sequence]
```

This report is produced once, at the end of Phase 3 implementation — not incrementally per step.

---

## §27. Pre-Implementation Verification Checklist

These are mechanical confirmations against the live, hardened schema — **not** open architecture questions. None of them require a design decision; they only require looking at `prisma/schema.prisma` and confirming or noting an exact name. This is Step 0 of the roadmap (§24).

- [ ] Confirm `User.organizationId` (or the exact equivalent field name) exists and is the foreign key to `Organization`.
- [ ] Confirm `User.role` exists as an enum with values matching `OWNER / OFFICE_MANAGER / SALES_REP / TECHNICIAN` (or note the actual enum name/values if renamed during Database Hardening).
- [ ] Confirm `User.isActive` exists as a boolean with this exact name.
- [ ] Confirm `User.passwordHash` exists as a string field with this exact name.
- [ ] Confirm `Organization` has no additional required field that the bootstrap flow (§12.4) would need to populate (e.g., a required `industryVertical` or similar) — if one exists, the setup wizard form must collect it too.
- [ ] Confirm primary keys are native PostgreSQL UUIDs as stated, so no `cuid()`-specific assumption leaks into any new code.

If any item above reveals a mismatch with this document's assumptions, record the actual name/shape as a one-line addendum to this section before proceeding to Step 1 — this is a documentation update, not an architecture change, and does not require re-approval under §1.

### §27 Addendum — Verified against the live schema (Phase 3, Step 0)

The following were confirmed against `prisma/schema.prisma` and the `20260626155723_init` migration. Each is a mechanical mapping note recorded under §27's own rule (documentation update, not an architecture change). The two items that exceeded a mechanical rename (the role-count difference and the missing `mustChangePassword` field) were escalated and explicitly decided by the architecture owner before implementation — see notes below.

- **`User.organizationId`** — ✅ exists, `@db.Uuid`, FK to `Organization`. As assumed.
- **`User.isActive`** — ✅ `Boolean @default(true)`, exact name. As assumed.
- **Primary keys** — ✅ native `@default(uuid()) @db.Uuid` throughout; no `cuid()` assumption leaks anywhere. As assumed.
- **`User.passwordHash`** — exists but is **nullable** (`String?`), not a required string. Implementation treats a `null` hash as "cannot authenticate" (login fails closed with the standard generic error), and `bootstrapOrganization` / `createTeammate` always write a non-null hash.
- **`User.role` enum** — the live enum is **`Role { OWNER, STAFF, FIELD }`** (3 values), not the 4-role set (`OWNER / OFFICE_MANAGER / SALES_REP / TECHNICIAN`) assumed in §10.1. **Decision (owner-approved):** implement against the live 3-role enum; do **not** modify the enum. Business-role → schema-role mapping:
  - `OWNER` → `OWNER` — full access (all records, reports, settings, team management).
  - `OFFICE_MANAGER` → `STAFF` and `SALES_REP` → `STAFF` — org-scoped leads/quotes/customers/jobs/scheduling; no settings/team; no owner-level financial reports.
  - `TECHNICIAN` → `FIELD` — assigned jobs only, mobile read/update.
  Consequently §10.4's per-role record scoping collapses to: `OWNER`/`STAFF` are organization-scoped (no per-user ownership restriction); `FIELD` is additionally scoped by assignment (`Job.assignedToId === session.user.id`). The `SALES_REP`-style "own leads only" record tier is not separately representable under the 3-role enum and is folded into `STAFF`; reinstating it is a future change gated on adding a role (§18).
- **§10.4 "technicianId"** — the live field is **`Job.assignedToId`** (`User?`). All `FIELD`-role ownership scoping uses `Job.assignedToId`.
- **`User` email uniqueness** — uniqueness is composite **`@@unique([organizationId, email])`**, not global. Email lookup during `authorize()` therefore cannot assume a single global match. Implementation looks the user up case-insensitively and, where more than one organization could hold the same email (public/demo multi-tenant mode), resolves deterministically; single-organization client deployments (the delivered mode, §3) have exactly one match.
- **Bootstrap-required `Organization` fields** — beyond `name`, the schema requires `slug` (`@unique`), `timezone`, `currency`, and `settings` (`Json`) to be non-null. **Decision (owner-approved):** the setup wizard collects only the four §12.4 inputs and **derives/defaults** the rest — `slug` from a slugified, uniqueness-checked `name`; `currency` defaults to `USD`; `timezone` defaults to `UTC`; `settings` defaults to `{}`. The frozen `Organization` schema is unchanged.
- **`mustChangePassword`** — no such field exists on `User`. §9.5's forced-first-login password change is therefore **deferred** (owner-approved): `createTeammate` issues a one-time temporary password shown once to the Owner (steps 1–3 of §9.5); the "forced change before reaching the dashboard" enforcement (step 4) is documented as a deferred feature for a future phase, since adding it requires a schema field and the Phase 2 schema is frozen.

No migration is created in Phase 3. No frozen-schema field is added, removed, or renamed.

---

## §28. Final Architecture Review

This review was performed before finalizing this version of the document.

**Consistency checks performed:**
- **Bootstrap:** §12.3 names exactly one approved approach (Setup Wizard, Option C) for Phase 3; §18 and §24 (Step 3) both consistently treat Option D (CLI script) as a documented future alternative, not a Phase 3 deliverable. No contradiction.
- **Session lifetime:** 7 days, stated once in §8.3, referenced consistently in §6.3 and nowhere contradicted.
- **Insufficient-role redirect:** toast-on-dashboard, stated once as approved in §11.3, referenced consistently in §6.4, §6.6, §16, and §17. The hard-403-page alternative appears only in §18 as a non-adopted future option.
- **Public registration default:** `false`, stated in §12.3 and §14, consistent with the risk entry in §20 and the verification expectations implied by §19's mandatory edge-case tests.
- **Implementation Standards (§21)** do not conflict with the defense-in-depth model in §10.3 or the file responsibilities in §23 — every file in §23 maps to exactly one of the responsibility rules in §21 (e.g., no file is assigned both "UI rendering" and "Prisma access").
- **Roadmap order (§24)** is dependency-consistent: core Auth.js config (1) before middleware (2) before bootstrap (3, which reuses Step 1's session issuance) before UI (4) before cross-cutting enforcement (5) before account/team features (6, which depend on enforcement) before hardening (7) before tests (8, which validate everything prior) before docs (9, which describe the finished system).
- **Definition of Done (§25)** maps cleanly onto the roadmap's steps and onto §19's test coverage — nothing in §25 is unverifiable by the artifacts produced in §24.

**Gaps checked for and not found:** no section requires implementation to invent a new role, route, environment variable, or file not already named in §10, §11.2, §13, §14, or §23 respectively.

**Conclusion:** No contradictions found. Implementation order is logical. Security recommendations are internally consistent. No required implementation detail is missing.

---

**This document is now ready to serve as the official implementation blueprint for Phase 3.** Implementation may proceed following §24, subject to completing §27 (Step 0) first, and is bound by §1 (Architecture Freeze), §21 (Implementation Standards), and §22 (Dependency Policy) throughout.
