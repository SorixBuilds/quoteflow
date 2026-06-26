# The Universal Internal Tool Blueprint
### A Reusable Operating System for Building, Packaging, and Selling Internal Business Tools — Any Industry, Every Project

> **How to use this document:** This is not a one-time plan — it's a permanent framework. Every time you start a new internal tool project (CRM, tracker, dashboard, workflow system), open this document, work through Sections 1-6 to plan and build it, Section 7 to adapt it to the specific industry, and Sections 9-11 to package and ship it. Section 12 is the condensed master checklist for when you already know the system and just need the sequence.

---

## SECTION 1: UNIVERSAL INTERNAL TOOL LIFECYCLE

Every internal business tool — regardless of industry — moves through the same 13 stages. Skipping a stage is the most common reason freelance builds either take too long, undersell their value, or fail to convert into paying client work.

### 1. Idea
**Objective:** Identify a specific, recurring operational pain inside a specific type of business.
**Activity:** Look for businesses where the same process — tracking something from "request" to "resolution" — currently lives in spreadsheets, whiteboards, group chats, or a generic tool not built for that workflow.
**Output:** A one-sentence problem statement: *"[Industry] businesses lose track of [thing] between [start point] and [end point]."*
**Exit criteria:** You can name the entity that flows through the system (a lead, a ticket, a property, a claim, a vehicle, a case) and the stages it passes through.

### 2. Market Validation
**Objective:** Confirm the pain is widespread, not anecdotal.
**Activity:** Search for industry forums, Facebook groups, subreddits, and trade association complaints. Check whether existing software (the big incumbent in that space) is criticized for the same gap you've identified. Check business count and average revenue per business in that vertical.
**Output:** 3-5 pieces of evidence the problem is real and common.
**Exit criteria:** You can describe the buyer persona's daily frustration in their own language, not yours.

### 3. Research
**Objective:** Understand how the target business currently operates, including the words they use.
**Activity:** Study how 2-3 existing tools in that space are structured (their navigation, their terminology, their pricing). Identify what they get right and what they leave undone (usually: the "in-between" stage — lead-to-quote, ticket-to-resolution, application-to-approval).
**Output:** A terminology glossary (what they call a "lead," what they call a "quote," what they call a "job") and a list of 2-3 competitor gaps.
**Exit criteria:** You could hold a 10-minute conversation with someone in that industry without sounding like an outsider.

### 4. Business Analysis
**Objective:** Quantify the cost of the problem in dollars, not just frustration.
**Activity:** Model the financial leak: average ticket size × estimated lost-conversion rate × deal volume = annual revenue at risk. This single number is what will anchor your pricing conversation later — see Section 10.
**Output:** A revenue-impact model with a believable, source-able range (not a guess pulled from nowhere).
**Exit criteria:** You can say "a business this size is plausibly losing $X-$Y per year to this gap" and defend the math.

### 5. Product Planning
**Objective:** Define what the tool actually is, in scope, before any design or code.
**Activity:** Name the core entity and its lifecycle stages (see Section 2-3 for the universal pattern). Separate features into MVP / V2 / Premium / Enterprise tiers (see Section 5 reusability matrix). Define primary and secondary personas (the owner/decision-maker, and the frontline staff who'll actually use it daily).
**Output:** A feature tier table and two personas with goals + frustrations.
**Exit criteria:** You can describe the MVP in one paragraph without using the word "and" more than three times — if you can't, scope is already too big.

### 6. Architecture
**Objective:** Decide the technical structure before writing code.
**Activity:** Apply the Universal Architecture (Section 2) and Universal Database Blueprint (Section 3) to this specific industry's entities and terminology.
**Output:** An entity-relationship plan and a component list.
**Exit criteria:** Every screen you'll eventually build maps to an entity and a relationship already defined on paper.

### 7. UI Design
**Objective:** Decide the visual and interaction patterns before building screens one-off.
**Activity:** Apply the Universal UI Blueprint (Section 4) — layout, navigation, dashboard, table, form, and modal patterns — to this industry's terminology and color/brand direction.
**Output:** A design-token sheet (colors, type, spacing) and a screen list.
**Exit criteria:** You could sketch every screen from memory using only the patterns in Section 4.

### 8. Development
**Objective:** Build the tool in a fixed, repeatable sequence.
**Activity:** Follow the Universal Development Blueprint (Section 5) step by step, on a clean Git branch per step.
**Output:** A working, deployed-to-staging application matching the MVP scope from Stage 5.
**Exit criteria:** Every item on the Development Checklist (Section 6) is checked.

### 9. Testing
**Objective:** Confirm the tool actually works under real-world conditions, not just the happy path.
**Activity:** Run the Testing Checklist (Section 6) — every role, every empty/loaded/error state, every form's invalid-input case.
**Output:** A signed-off QA pass with no open critical bugs.
**Exit criteria:** You'd be comfortable demoing this live, unscripted, to a stranger.

### 10. Deployment
**Objective:** Get the tool live, secure, and monitored on infrastructure that costs nothing or near-nothing until there's real revenue to justify spend.
**Activity:** Follow the Deployment Checklist (Section 6).
**Output:** A live URL, a protected `main` branch, environment variables set in the host, not just locally.
**Exit criteria:** The tool works identically for a stranger visiting the live URL as it does on your local machine.

### 11. Portfolio Creation
**Objective:** Turn the build into an asset that attracts paying clients, not just a finished side project.
**Activity:** Follow the Portfolio Project Blueprint (Section 9).
**Output:** Case study, screenshots, Loom walkthrough, polished GitHub repo, landing-page copy.
**Exit criteria:** A stranger looking only at your portfolio page understands the problem, the solution, and the business impact in under 60 seconds.

### 12. Client Delivery
**Objective:** Convert the portfolio asset into paid, scoped client work.
**Activity:** Apply the Service Packaging & Pricing Framework (Section 10) — pitch the right tier, scope the engagement, set milestone payments.
**Output:** A signed scope of work and a delivered, client-specific build.
**Exit criteria:** Client has a working system in production and a documented handover.

### 13. Maintenance
**Objective:** Turn a one-time build into recurring revenue and a long-term relationship.
**Activity:** Offer a maintenance retainer (Section 10), monitor the live system, triage and ship fixes/improvements on a predictable cadence.
**Output:** A retainer agreement or a clear "see you for the next project" close.
**Exit criteria:** The client knows exactly what happens if something breaks and what it costs to add new features later.

---

## SECTION 2: UNIVERSAL INTERNAL TOOL ARCHITECTURE

These components appear, in some form, in almost every internal business tool. Build each one once, well, and reuse it.

| Component | Why it exists |
|---|---|
| **Authentication** | Internal tools hold sensitive business and customer data — there is no internal tool without a login wall. It's also the first thing that establishes *whose* data you're looking at (multi-tenancy). |
| **Users** | Every action in the system needs an owner — "who created this," "who's assigned to this," "who changed this" are constant questions in any operational tool. |
| **Roles & Permissions** | The owner, the office staff, and the frontline worker need different slices of the same system. Without role separation, you either over-expose sensitive data (financials visible to everyone) or under-empower staff (everyone has to ask the owner for everything). |
| **Dashboard** | The single most valuable screen in any internal tool — it answers "what's the state of my business right now" without forcing the owner to click through five screens. This is consistently the screenshot that sells the project. |
| **Records (Core Entities)** | The actual "thing" being tracked — leads, tickets, properties, claims, vehicles. Everything else in the tool exists to support managing this one entity well. |
| **CRUD Operations** | Create, Read, Update, Delete — the baseline operations every record needs. If a tool can't do all four cleanly, it's not actually replacing the spreadsheet it's meant to replace. |
| **Status Management** | Records move through a lifecycle (new → in progress → resolved). Status is what turns a flat list into a *pipeline* — the single biggest upgrade over a spreadsheet. |
| **Search** | Once there are more than ~20 records, browsing stops working. Search is the difference between "usable" and "we gave up and went back to Ctrl+F in a spreadsheet." |
| **Filtering** | Different roles need different slices of the same list (my leads, leads from this source, leads from this week). Filtering is what makes one shared table useful to five different people at once. |
| **Reporting** | The owner doesn't just want to see *current* state — they want to know what's working (which channel, which rep, which service type) so they can make decisions with money attached. This is what justifies the price of the tool. |
| **Notifications** | Operational tools fail when something sits unnoticed (a lead untouched for 3 days, a quote about to expire). Notifications are what prevent the tool from becoming "another inbox to ignore." |
| **Settings** | Every business customizes terminology, pricing, team structure, and integrations slightly differently. Settings is what lets one codebase serve many businesses without a code change per client. |
| **Activity Logs** | When something goes wrong ("why does this record say X"), an audit trail is the difference between a 30-second answer and a trust-destroying mystery. It also protects you and the client in disputes. |

**Additional components worth standardizing across projects (less universal, still common):**
- **Document/File attachment** — contracts, photos, signed forms attached to a record
- **Notes/Comments** — free-text context that doesn't fit a structured field
- **Tasks/Reminders** — discrete follow-up actions tied to a record
- **Calendar/Scheduling** — when the core entity involves an appointment, visit, or deadline
- **Tags/Categories** — lightweight, user-defined classification on top of fixed statuses

---

## SECTION 3: UNIVERSAL DATABASE BLUEPRINT

Almost every internal tool's schema is a variation on the same core shape: **an Organization, the People in it, a Primary Record that flows through a pipeline, one or two records it converts into, and a handful of supporting tables that attach context to all of the above.**

### The Universal Core Tables

| Table | Purpose | Key Relationships | Reusability |
|---|---|---|---|
| **Organizations / Companies** | The tenant — every other table is scoped to this. Without it, you can't sell the same codebase to multiple clients/businesses. | Has many Users, Records, Customers | 100% reusable — never changes shape across industries |
| **Users** | The people operating the system. | Belongs to Organization; has a Role | 100% reusable |
| **Roles** (often an enum, not a table, for V1) | Defines what a user can see/do. | Referenced by Users | 100% reusable |
| **Primary Record** (Lead / Ticket / Case / Property / Vehicle / Application) | The thing flowing through the pipeline — this is the table that gets renamed per industry but never restructured. | Belongs to Organization, assigned to a User, has a Status, generates Activities | Structure 100% reusable; name + fields vary |
| **Conversion Record** (Quote / Estimate / Proposal / Work Order / Policy) | What the Primary Record turns into once it's qualified/accepted. Usually has line items and a status lifecycle of its own. | Belongs to one Primary Record; converts into a Fulfillment Record | Structure ~90% reusable |
| **Fulfillment Record** (Job / Service Visit / Renewal / Repair / Onboarding) | What happens after conversion — the actual work performed. | Belongs to one Conversion Record; linked to an Account/Customer | Structure ~85% reusable |
| **Accounts / Customers** | The actual person or business the records are about — separate from the Primary Record because one Account often has many Records over time (repeat business). | Belongs to Organization; has many Primary Records, Fulfillment Records | 100% reusable |
| **Sources / Channels** | Where Primary Records originate (referral, ad channel, inbound call, walk-in) — exists in nearly every lead-driven tool. | Belongs to Organization; referenced by Primary Records | ~95% reusable |
| **Activities** | An append-only audit log of everything that happened to a record — status changes, communications, system events. | Belongs to a Primary Record (or any record type) | 100% reusable |
| **Notes** | Free-text context, attachable to any record type. | Polymorphic — belongs to Primary Record or Account | 100% reusable |
| **Tasks** | Discrete, assignable follow-up items. | Belongs to a Primary Record; assigned to a User | 100% reusable |
| **Documents** | File/photo attachments. | Polymorphic — belongs to any record type | 100% reusable (once file storage is added — see cost-tier note in any project's deployment plan) |
| **Statuses** | If you outgrow a fixed enum (client wants custom pipeline stages), this becomes its own table: ordered, organization-scoped, customizable. | Belongs to Organization; referenced by Primary/Conversion/Fulfillment Records | Worth promoting to a real table once you're past 3-4 client builds — it's what lets a client customize their own pipeline without you touching code |
| **Settings** | Organization-level configuration (terminology, branding, tax rate, business hours). | Belongs to Organization (often just a JSON column) | 100% reusable |
| **Audit Logs** | System-level change tracking (who changed what field, when) — distinct from Activities, which are more business-narrative (e.g. "status changed to Won"). For most portfolio/early-client builds, Activities alone are sufficient; a dedicated Audit Log table becomes necessary once compliance or dispute-resolution matters (insurance, healthcare-adjacent, finance). | Polymorphic | Reusable once promoted to a dedicated table |

### How this maps to a generic ERD
```
Organization
 ├─ Users (role-scoped)
 ├─ Accounts (Customers/Clients/Policyholders/Tenants)
 │    └─ has many → Primary Records (over time, repeat business)
 ├─ Sources/Channels
 └─ Primary Records (Lead/Ticket/Case/Property/Vehicle)
       ├─ Status (lifecycle stage)
       ├─ Activities (audit trail)
       ├─ Notes
       ├─ Tasks
       ├─ Documents
       └─ Conversion Record (Quote/Estimate/Proposal)
             └─ Fulfillment Record (Job/Visit/Renewal)
                   └─ (optional) Billing Record (Invoice/Payment)
```

**Why this generalizes:** whether you're tracking a roofing lead, an insurance renewal, a property maintenance request, or a consulting inquiry — the shape is identical: *something comes in → gets qualified → gets priced/proposed → gets fulfilled → gets billed.* Only the labels and a handful of trade-specific fields change. This is the single most valuable insight in this entire blueprint: **you are not rebuilding a database 20 times, you are relabeling one database 20 times.**

---

## SECTION 4: UNIVERSAL UI BLUEPRINT

### The screens that exist in nearly every internal tool
1. **Login / Register** — entry point, every tool has it
2. **Dashboard** — KPI summary + pipeline visual + chart + recent activity
3. **List View** (per core entity) — searchable, filterable, sortable table
4. **Detail View** (per core entity) — full record context + related records + activity timeline
5. **Create/Edit Form** (per core entity) — structured data entry with validation
6. **Reports** — aggregated analytics, usually source/channel performance + conversion metrics
7. **Settings** — organization profile, team/roles, lookup data (sources, statuses, pricing)

### Layout pattern (reusable across every project)
```
┌─────────────────────────────────────────────┐
│ Topbar: [Logo] [Global Search] [+ New] [🔔] │
├───────────┬─────────────────────────────────┤
│ Sidebar   │  Page Content                   │
│ - Dashboard│                                 │
│ - [Entity1]│                                 │
│ - [Entity2]│                                 │
│ - Reports  │                                 │
│ - Settings │                                 │
└───────────┴─────────────────────────────────┘
```
Persistent dark/ink sidebar, light content area — this single pattern covers ~90% of internal tools across every industry you'll touch.

### Navigation pattern
- Sidebar items are role-filtered (a frontline worker sees a reduced set vs. the owner).
- A single global "+ New [Primary Record]" action in the topbar, accessible from any screen — this is the single highest-friction-reduction UI decision you can make, because record creation happens far more often than any other action.

### Dashboard pattern
```
[KPI Card] [KPI Card] [KPI Card] [KPI Card] [KPI Card]
[             Pipeline / Status Board              ]
[  Source Performance Chart   ][  Recent Activity  ]
```
- KPI row: always 4-6 numbers, each with a trend indicator
- A visual pipeline (kanban or funnel) is the second-most valuable element — it's what makes the tool feel alive rather than a static report
- One chart that ties cost/effort to outcome (source ROI, rep performance, channel conversion) — this is consistently the "wow" moment in a sales demo

### Table/List pattern
- Search bar + filter chips above the table
- Sortable column headers
- Status shown as a colored pill, never plain text
- Row click → detail view (not a separate "view" button — reduces clicks)
- Empty state always has an icon + one sentence + a primary action, never a blank gray box
- Pagination or infinite scroll once records exceed ~50

### Form pattern
- Grouped into logical sections (Contact Info / Details / Assignment), not one long unbroken list of fields
- Inline validation, not "submit and see all errors at once"
- A visible "unsaved changes" indicator if the user tries to navigate away
- Primary action (Save) visually distinct from secondary (Cancel/Save Draft)

### Modal pattern
- **Quick actions** (create a simple record, confirm a status change) → modal/drawer, stays in context
- **Complex multi-step entities** (building a quote/proposal with line items) → full page, not a modal — modals that scroll internally are a usability failure
- Destructive actions (delete) always require a confirmation step naming what will be deleted

---

## SECTION 5: UNIVERSAL DEVELOPMENT BLUEPRINT (Step-by-Step Sequence)

This sequence is fixed. Follow it in this order on every project — the order itself prevents the most common rebuild-causing mistakes (e.g., building forms before the schema that backs them is finalized).

### Step 1 — Setup Project
- **Objective:** A running local dev environment with the standard stack (Next.js, TypeScript, Tailwind, shadcn/ui).
- **Deliverables:** `npm run dev` works; starter page loads.
- **Completion criteria:** Project boots with zero console errors.
- **Common mistakes:** Skipping TypeScript "to save time" — costs far more time later in bug-hunting.
- **Quality checks:** ESLint configured and passing on the starter project.

### Step 2 — Setup GitHub
- **Objective:** Version control and a professional commit history from commit #1.
- **Deliverables:** Private repo created, `.gitignore` confirmed to exclude `.env`, first commit pushed.
- **Completion criteria:** Repo visible on GitHub with correct files (no secrets).
- **Common mistakes:** Committing `.env` or `node_modules` because `.gitignore` wasn't checked first.
- **Quality checks:** `git check-ignore -v .env` returns a match before any commit.

### Step 3 — Setup Database
- **Objective:** A live Postgres instance (Neon, free tier) and an initial schema migrated.
- **Deliverables:** `schema.prisma` written using the Universal Database Blueprint (Section 3), `npx prisma migrate dev` run successfully.
- **Completion criteria:** All core tables exist; relationships visible in `prisma studio`.
- **Common mistakes:** Embedding line items or sub-records as JSON "to move faster" — normalize from day one, since it's far cheaper than a later migration once real data exists.
- **Quality checks:** Every foreign key used in a filter has an index.

### Step 4 — Setup Authentication
- **Objective:** Registration, login, role-based session, and route protection.
- **Deliverables:** Auth.js wired up; `middleware.ts` enforcing role-based route access.
- **Completion criteria:** A user of each role can log in and is correctly restricted.
- **Common mistakes:** Enforcing roles only at the route/middleware level and forgetting record-level checks inside server actions (e.g., a Sales Rep querying *all* leads instead of only their own).
- **Quality checks:** Manually attempt to access a restricted page/action as the wrong role — confirm it's blocked.

### Step 5 — Create Layout
- **Objective:** The persistent shell (sidebar + topbar) every other screen lives inside.
- **Deliverables:** Role-filtered sidebar nav, global "+ New" action, design tokens applied (Section 4).
- **Completion criteria:** Layout renders correctly at desktop and mobile widths.
- **Common mistakes:** Hardcoding nav items instead of deriving them from the role-access map — makes every future role change a multi-file edit.
- **Quality checks:** Confirm each of the 4 standard roles sees the correct nav subset.

### Step 6 — Create Dashboard
- **Objective:** The single highest-value screen — KPI row, pipeline visual, chart, activity feed.
- **Deliverables:** Aggregation queries for KPIs, a kanban or funnel component, a source/channel performance chart.
- **Completion criteria:** KPIs match a manual count against seed data.
- **Common mistakes:** Building the dashboard before the underlying entities exist, leading to fake/static numbers that need a full rebuild later.
- **Quality checks:** Test with zero data (empty state), light data, and heavy data (50+ records) — all three must render correctly.

### Step 7 — Create List Pages (Primary Record)
- **Objective:** Full CRUD list view for the core entity (Lead/Ticket/Case/etc.).
- **Deliverables:** Searchable/filterable/sortable table, status pills, row-click-to-detail.
- **Completion criteria:** A new record created here is immediately visible and correctly filtered by role.
- **Common mistakes:** Building filtering as client-side-only logic that breaks once record counts grow — push filters into the database query.
- **Quality checks:** Confirm a Sales-Rep-equivalent role only ever sees their assigned records.

### Step 8 — Create Forms (Create/Edit)
- **Objective:** Validated data entry for the core entity.
- **Deliverables:** React Hook Form + Zod schema shared between client and server validation.
- **Completion criteria:** Invalid input is rejected with a clear, field-level message both client-side and server-side.
- **Common mistakes:** Trusting client-side validation alone — always re-validate server-side, since a server action can be called directly.
- **Quality checks:** Submit the form with every required field empty — confirm no silent failures.

### Step 9 — Build Conversion & Fulfillment Records
- **Objective:** The "what happens next" workflow — Quote/Proposal → Job/Visit, including any document generation (PDF) and status lifecycle.
- **Deliverables:** Conversion record builder, status tracking, conversion-to-fulfillment trigger.
- **Completion criteria:** Accepting/approving a Conversion Record creates exactly one Fulfillment Record, never zero or duplicate.
- **Common mistakes:** Trusting client-calculated totals — always recompute and store totals server-side at the moment of save.
- **Quality checks:** Test the full chain end-to-end: create Primary Record → convert → fulfill → confirm data consistency at each step.

### Step 10 — Build Supporting Entities
- **Objective:** Accounts/Customers, Notes, Tasks, Documents — the context layer around the core workflow.
- **Deliverables:** Customer detail view showing linked history; note/task creation on any record.
- **Completion criteria:** A customer's full history (every Primary/Conversion/Fulfillment record linked to them) is visible in one place.
- **Common mistakes:** Forgetting to recalculate aggregate fields (lifetime value, total jobs) on every relevant write — leads to silently stale numbers.
- **Quality checks:** Verify aggregate values match a manual sum against seed data.

### Step 11 — Create Reports
- **Objective:** Channel/source ROI, conversion rate, turnaround time — the analytics that justify the tool's price.
- **Deliverables:** Date-range-filterable report queries, at least one chart, at least one comparison table.
- **Completion criteria:** Numbers match manual calculation against seed data.
- **Common mistakes:** Building reports as raw SQL one-offs instead of reusable aggregation functions — makes the next project's reports slower to build instead of faster.
- **Quality checks:** Test date-range filtering across month/year boundaries.

### Step 12 — Build Settings
- **Objective:** Organization profile, team/role management, lookup data (sources/statuses/pricing).
- **Deliverables:** Settings forms, role-change controls (Owner-only), source/status management.
- **Completion criteria:** A non-Owner role cannot change roles or remove the last remaining Owner.
- **Common mistakes:** Allowing the last Owner account to be demoted/deleted, leaving an organization with no admin.
- **Quality checks:** Attempt this exact failure case and confirm it's blocked.

### Step 13 — Testing
- **Objective:** Confidence the system works under real conditions, not just the happy path.
- **Deliverables:** Unit tests on calculation logic, integration tests on the conversion chain, a manual QA pass across every role.
- **Completion criteria:** Every item on the Testing Checklist (Section 6) is checked.
- **Common mistakes:** Testing only as the Owner role — most real bugs live in the restricted roles' edge cases.
- **Quality checks:** A second person (or a fresh run-through after a day away) can use the tool without you explaining anything.

### Step 14 — Deployment
- **Objective:** A live, secure, monitored production instance.
- **Deliverables:** Production database, environment variables set in the host, migration run against production, custom domain (optional).
- **Completion criteria:** The live URL behaves identically to local dev for a stranger with no context.
- **Common mistakes:** Running `migrate dev` against production instead of `migrate deploy` — risks destructive schema drift.
- **Quality checks:** Full manual QA pass repeated against the live URL, not just localhost.

### Step 15 — Seed/Demo Data
- **Objective:** A reproducible, realistic demo dataset.
- **Deliverables:** A seed script generating a fictional company, 3 demo users (one per key role), 20-30 core records across multiple statuses/sources.
- **Completion criteria:** Re-running the seed script produces a consistent, demo-ready dataset every time.
- **Common mistakes:** Hand-entering demo data manually each time you need to re-demo — wastes time and risks an inconsistent demo.
- **Quality checks:** Run the seed script on a fresh database and confirm the dashboard/reports look "lived-in," not sparse.

### Step 16 — Portfolio Packaging
- **Objective:** Convert the finished build into a client-attracting asset.
- **Deliverables:** Screenshots, case study, README, Loom walkthrough (see Section 9).
- **Completion criteria:** A stranger understands the business value within 60 seconds of viewing the portfolio page.
- **Common mistakes:** Skipping the explicit "this is illustrative, not a real client" disclosure — implying a client relationship that doesn't exist is a credibility risk the moment anyone asks a follow-up question.
- **Quality checks:** Show the finished portfolio page to someone unfamiliar with the project and ask them to explain it back to you.

---

## SECTION 6: UNIVERSAL INTERNAL TOOL CHECKLIST (Master Printable Checklist)

### Planning Checklist
- [ ] Problem statement written in one sentence
- [ ] Target industry and buyer persona identified
- [ ] 3-5 pieces of market-validation evidence gathered
- [ ] Revenue-impact model built with a defensible range
- [ ] Core entity (Primary Record) named
- [ ] Lifecycle stages of the core entity mapped
- [ ] MVP / V2 / Premium / Enterprise feature tiers defined
- [ ] Primary and secondary personas documented

### Product Checklist
- [ ] Product name and one-line value proposition written
- [ ] Competitive gap (vs. the incumbent tool in that space) identified
- [ ] MVP scope fits in one paragraph
- [ ] Demo company/persona names chosen (for later seed data)

### Architecture Checklist
- [ ] Universal components (Section 2) mapped to this project
- [ ] Roles and permission matrix defined
- [ ] Notification triggers identified
- [ ] Settings/customization needs identified

### Database Checklist
- [ ] Organization (tenant) table defined
- [ ] Users + Roles defined
- [ ] Primary Record table and fields defined
- [ ] Conversion Record table and fields defined
- [ ] Fulfillment Record table and fields defined
- [ ] Accounts/Customers table defined
- [ ] Sources/Channels table defined
- [ ] Activities, Notes, Tasks, Documents tables defined
- [ ] All foreign keys indexed
- [ ] Migration run successfully on a fresh database

### UI Checklist
- [ ] Design tokens (colors, type, spacing) defined
- [ ] Layout (sidebar + topbar) built
- [ ] Dashboard (KPIs + pipeline + chart + activity) built
- [ ] List view (search/filter/sort) built for each core entity
- [ ] Detail view built for each core entity
- [ ] Create/Edit forms built with validation
- [ ] Reports screen built
- [ ] Settings screen built
- [ ] Empty/loading/error states designed for every screen

### Development Checklist
- [ ] Steps 1-16 of Section 5 completed in order
- [ ] Every server action enforces auth + record-level scoping
- [ ] Every form validated client + server side
- [ ] All conversion/fulfillment chains tested end-to-end

### Testing Checklist
- [ ] Every screen tested at every role
- [ ] Every list tested with 0, 1, and 50+ records
- [ ] Every form tested with invalid input
- [ ] Mobile/field-worker view tested on an actual device
- [ ] Generated documents (PDFs, etc.) checked against on-screen totals
- [ ] Aggregate fields (lifetime value, KPIs) verified against manual calculation

### Deployment Checklist
- [ ] Production database created (separate from dev)
- [ ] Environment variables set in the host
- [ ] Production migration run (`migrate deploy`, not `migrate dev`)
- [ ] Live URL manually QA'd end-to-end
- [ ] `main` branch protected (PR required before merge)

### GitHub Checklist
- [ ] Repo created, `.env` confirmed git-ignored before first commit
- [ ] Branching strategy followed (one branch per feature)
- [ ] Conventional commit messages used throughout
- [ ] PR opened and merged (squash) for every feature, even solo
- [ ] CI workflow running lint + tests on every PR
- [ ] README, CHANGELOG, LICENSE written
- [ ] Issue templates, labels, milestones, project board set up
- [ ] Repository flipped from private to public only once polished

### Portfolio Checklist
- [ ] 7-shot screenshot checklist captured (Section 9)
- [ ] Case study written with explicit illustrative/real disclosure as applicable
- [ ] Loom walkthrough recorded (3-4 minutes)
- [ ] Landing page / portfolio card copy written
- [ ] Seed script reproduces the demo dataset reliably

### Client Delivery Checklist
- [ ] Discovery call held, pain quantified in dollars
- [ ] Correct package tier (Section 10) proposed
- [ ] Scope of work and milestone payments documented in writing
- [ ] Client-specific terminology/branding/fields configured
- [ ] Handover documentation delivered (admin guide + maintenance terms)
- [ ] Retainer or "next project" conversation had explicitly, not left implied

---

## SECTION 7: INDUSTRY MAPPING FRAMEWORK

The architecture never changes. Only four things change per industry: **terminology, a handful of trade-specific fields, the pricing/line-item model, and (occasionally) one extra entity unique to that field.**

| Industry | Primary Record | Conversion Record | Fulfillment Record | What gets added | What stays identical |
|---|---|---|---|---|---|
| **HVAC** | Lead | Quote | Job | System type, tonnage, seasonal maintenance plan | Pipeline, quote engine, dashboard, reports |
| **Plumbing** | Lead | Quote | Job | Fixture type, emergency/same-day flag | Same core |
| **Roofing** | Lead | Estimate | Job | Roof material, square footage, insurance-claim flag | Same core |
| **Electrical** | Lead | Quote | Job | Panel type, permit/inspection tracking field | Same core |
| **Property Management** | Maintenance Request | Work Order Estimate | Work Order | Unit/property reference, tenant contact, lease linkage | Same core |
| **Insurance** | Renewal/Application | Quote/Policy Proposal | Policy/Renewal | Policy type, coverage limits, renewal date, underwriting notes | Same core, "Customer" becomes "Policyholder" |
| **Auto Repair** | Repair Request | Estimate | Repair Order | Vehicle VIN/make/model, mileage, parts list | Same core |
| **Agencies** (marketing/dev/design) | Inquiry | Proposal | Project/Engagement | Service type, retainer vs. project flag, deliverables list | Same core |
| **Consultants** | Inquiry | Proposal | Engagement | Hourly vs. fixed-fee flag, session/deliverable tracking | Same core |
| **General Service Businesses** | Lead/Request | Quote/Estimate | Job/Service Visit | Service category, recurring-visit flag | Same core |

### What changes
- **Terminology** — "Lead" → "Renewal" (insurance), "Job" → "Work Order" (property management). Implement this as a single terminology config (Section 8) so screens read labels dynamically rather than hardcoding strings.
- **Trade-specific fields** — added to the Primary or Conversion record as nullable/JSON-extension fields, never by restructuring the core table.
- **Pricing/line-item model** — line-item structure stays identical; the *templates* (preset line items per job type) change per vertical.
- **One extra entity, occasionally** — e.g., insurance needs a "Policy" entity beyond the standard three; property management needs a "Property/Unit" entity. These are additive, not replacements.

### What stays the same
- Auth, roles, dashboard layout, table/form/modal patterns, the Organization→Account→Primary→Conversion→Fulfillment chain, Activities/Notes/Tasks/Documents, reporting structure, deployment pipeline, GitHub workflow.

### What gets removed
- Vertical-irrelevant fields (e.g., "tonnage" makes no sense for a consulting Inquiry — leave it out, don't make it generically required).
- Any feature that doesn't map to that industry's actual workflow (e.g., a "technician mobile view" isn't relevant if there's no field-dispatch component, as with a consulting practice).

---

## SECTION 8: INTERNAL TOOL REUSABILITY MATRIX

| Category | Reusable as-is | Reusable as a template | Industry-specific (rebuild each time) |
|---|---|---|---|
| **Auth & Roles** | Auth.js config, middleware pattern, role-access map structure | — | Specific role names per industry (Adjuster vs. Technician) |
| **Layout & Navigation** | Sidebar/Topbar shell, design-token system | Nav item list (swap labels) | Brand colors per client |
| **Database Schema** | Organization, Users, Activities, Notes, Tasks, Documents tables | Primary/Conversion/Fulfillment table shape | Trade-specific fields, terminology |
| **UI Components** | Table component, KPI card, modal/drawer system, form components | Dashboard layout composition | Chart types specific to that industry's KPIs |
| **PDF/Document Generation** | Generation engine/library wiring | Document template structure | Line-item templates, branding |
| **Reporting Logic** | Aggregation query patterns (date-range filtering, grouping) | Specific metrics shown | Industry-specific benchmarks/comparisons |
| **Deployment Pipeline** | Vercel + Neon + GitHub Actions setup | — | Per-client environment variables |
| **Seed/Demo Data Generator** | Generator script structure | Demo company/persona names | Industry-appropriate sample records |
| **Portfolio Assets** | Case study structure, screenshot checklist, README template | Copy/positioning language | Industry-specific pain points and ROI math |
| **Pricing Framework** | Tier structure (Starter/Standard/Premium/Enterprise) | — | Price anchoring (ticket size differs hugely by industry) |

### What should become a standalone, documented template
1. **The base codebase itself** — a private "boilerplate" repo containing Organization/User/Auth/Layout/Activity/Notes/Tasks/Documents already built, with the Primary/Conversion/Fulfillment tables left as a clearly marked extension point.
2. **A terminology config file** — a single JSON/TS object mapping internal field names to display labels, swapped per project (`{"primaryRecord": "Lead", "conversionRecord": "Quote", "fulfillmentRecord": "Job"}` → swap to `{"primaryRecord": "Renewal", "conversionRecord": "Proposal", "fulfillmentRecord": "Policy"}` for an insurance build).
3. **A line-item template library** — pre-built starter line items per common vertical (HVAC, plumbing, roofing, etc.) so a new client build starts with realistic defaults, not a blank quote builder.
4. **A pitch deck template** — Problem → System → ROI payoff → Pricing, with placeholders for industry-specific numbers.
5. **A discovery-call script** — the Section 10 question set, reusable verbatim across industries with only the entity names swapped.

### One codebase, multiple service offerings
Once the boilerplate above exists, a new vertical launch is: clone boilerplate → apply terminology config → swap line-item templates → adjust 3-5 trade-specific fields → re-skin design tokens → re-run portfolio packaging (Section 9) with new screenshots. This is a 1-3 day re-skin, not a rebuild — which is what makes "8+ verticals from one core product" a realistic freelance growth strategy rather than a slide-deck fantasy.

---

## SECTION 9: PORTFOLIO PROJECT BLUEPRINT (Repeatable, Per-Project)

### Case Study Structure (use for every project)
1. **Client Scenario** — who, how big, what they were doing before (illustrative or real — disclose honestly either way)
2. **The Problem** — the specific operational gap, in their language
3. **Challenges** — 2-3 genuine technical/design difficulties you solved
4. **Solution** — what you built, in one paragraph
5. **Features Implemented** — bulleted list
6. **Technical Approach** — stack + architecture decisions, briefly
7. **Business Impact** — modeled or real revenue-recovery math
8. **Lessons Learned** — one genuine insight (this is what makes the case study sound human, not templated)
9. **Future Roadmap** — what V2 would include

### Screenshots Plan (the same 7-shot structure every time)
1. Dashboard (KPI row + pipeline) — hero shot
2. Primary Record detail view with activity timeline
3. Conversion Record builder mid-edit
4. Conversion Record status progression (sent → viewed → accepted, or equivalent)
5. Source/channel performance chart
6. Mobile/field-worker view (if applicable to the industry)
7. An empty state (signals design polish, not just happy-path screens)

### Demo Data Plan
- One fictional company in the target vertical
- 20-30 Primary Records across multiple sources/channels and statuses (mix of won/lost/in-progress so the pipeline looks lived-in)
- A handful of Conversion Records in different status stages
- A handful of completed Fulfillment Records to populate reports

### Demo Users
- One Owner/Admin persona
- One Office/Coordinator persona (the day-to-day operator)
- One Frontline/Field persona (if the industry has field workers — technician, adjuster, inspector)

### Demo Script (10-minute full version, cut to 3-4 minutes for portfolio)
| Time | Beat |
|---|---|
| 0:00-1:00 | Hook — name the universal pain in this industry's language |
| 1:00-3:00 | Show a record arriving and moving through the pipeline |
| 3:00-5:30 | Build and "send" a Conversion Record live |
| 5:30-7:00 | Show status progression and conversion into a Fulfillment Record |
| 7:00-8:30 | Dashboard/reports payoff — the ROI chart |
| 8:30-9:30 | Frontline/field view, if applicable |
| 9:30-10:00 | Close — "Everything you just saw, I build custom, tuned to your workflow" |

### Portfolio Writeup Template
*Headline → Subhead → Body (problem + what you build instead) → CTA.* Reuse the exact structure from any prior project, swap only the industry-specific nouns and numbers.

### GitHub Repository Structure
See Section 11 in full — identical structure every time, only README content changes.

### README Structure
Title → screenshot → problem → features → tech stack → live demo link → screenshots gallery → getting-started instructions → environment variables table → license.

### Loom Walkthrough Structure
3-4 minutes: hook → pipeline → conversion builder → dashboard payoff → close. Never longer — long demos lose viewers before the payoff moment lands.

### Client Presentation Structure (sales call deck/one-pager)
1. The problem (with the lost-revenue math)
2. The system (screenshots, not slides of text)
3. The payoff visual (the ROI/performance chart — strongest single asset)
4. What I build for you specifically (tie back to their stated pain from discovery)
5. Pricing & next step

---

## SECTION 10: SERVICE PACKAGING & PRICING FRAMEWORK

### Starter Package
- **Features:** Auth + roles (2 roles), Primary Record pipeline (list + kanban + detail), basic Conversion Record (no PDF, just status tracking), simple dashboard (3-4 KPIs), one Account/Customer view
- **Deliverables:** Deployed app, basic handover doc, 1 round of revisions
- **Ideal client:** Solo operator or very small team (1-5 people) testing whether a custom tool is worth it
- **Scope limits:** No custom reports, no integrations, no document generation, single Conversion→Fulfillment flow only
- **Typical build time:** 1-2 weeks
- **Recommended pricing range:**
  - New freelancer: $800-$1,500
  - Intermediate: $1,500-$2,500
  - Experienced: $2,500-$4,000

### Standard Package
- **Features:** Everything in Starter + full role set (3-4 roles), Conversion Record with PDF/document export, dashboard with charts, reports screen (source/channel performance), Fulfillment Record tracking, field/mobile-optimized view if applicable
- **Deliverables:** Deployed app, seed/demo data, handover doc + 30-day bug-fix window, 2 rounds of revisions
- **Ideal client:** Established small business (5-30 employees) replacing spreadsheets/whiteboards with a real system
- **Scope limits:** No third-party integrations (accounting software, payment processors), no multi-location support
- **Typical build time:** 3-5 weeks
- **Recommended pricing range:**
  - New freelancer: $2,000-$3,500
  - Intermediate: $3,500-$6,000
  - Experienced: $6,000-$10,000

### Premium Package
- **Features:** Everything in Standard + payment/invoicing integration, automated notifications (email/SMS), recurring/subscription record support, advanced reporting (custom date ranges, exportable), one third-party integration (e.g., accounting software, calendar sync)
- **Deliverables:** Deployed app, full documentation (admin + API if relevant), 60-day support window, 3 rounds of revisions, a short training session/Loom for the client's team
- **Ideal client:** Growing business (15-50+ employees) ready to commit to the tool as their system of record
- **Scope limits:** Multi-location support and custom AI features are out of scope unless separately quoted
- **Typical build time:** 6-10 weeks
- **Recommended pricing range:**
  - New freelancer: $5,000-$8,000
  - Intermediate: $8,000-$15,000
  - Experienced: $15,000-$25,000+

### Enterprise Package
- **Features:** Everything in Premium + multi-location/multi-branch support, custom integrations (their existing back-office stack), AI-assisted features (drafting, scoring, summarization), white-label/custom domain branding, SLA-backed support
- **Deliverables:** Deployed app, full technical documentation, dedicated support agreement, quarterly review check-ins
- **Ideal client:** Multi-location operators, franchises, or agencies reselling the tool to their own client base
- **Scope limits:** Defined per contract — this tier is fully custom-scoped, not templated
- **Typical build time:** 10-16+ weeks, often phased
- **Recommended pricing range:**
  - Intermediate: $20,000-$40,000
  - Experienced: $40,000-$100,000+ (often with an ongoing license/retainer component)

### When to upsell
- Client asks "can it also do X" where X is a Premium-tier feature → quote it as a scoped add-on, don't silently absorb it into the current price.
- Client's team has grown noticeably since the original build → reintroduce the conversation around the next tier proactively, don't wait for them to ask.

### When to offer retainers
- After delivery, once the client is actively using the tool daily (usually 2-4 weeks post-launch) — this is when small requests start arriving organically. Convert that pattern into a monthly retainer (a fixed number of hours/requests per month) rather than ad-hoc invoicing each time.

### How to avoid scope creep
- Every package tier has an explicit "Scope Limits" line — put this in the signed proposal, not just in your head.
- Any request outside the signed scope gets a one-line response: *"That's outside this phase's scope — I can quote it as an add-on or fold it into the next phase."* Never silently absorb extra work "to be nice"; it trains the client to expect unlimited scope at a fixed price.

### How to structure revisions
- Define the number of revision rounds per tier (above) explicitly in the proposal.
- A "revision" = changes to already-delivered, in-scope features. A *new* feature request is not a revision — it's a change order.

### How to structure milestone payments
A reusable 3-milestone structure across all tiers:
1. **50% upfront** — before any work begins (covers your time risk on a no-show client)
2. **30% at mid-build checkpoint** — when the core pipeline/dashboard is demoable
3. **20% on final delivery** — after the client has tested it themselves and signed off

For Enterprise/phased work, break into per-phase milestones using the same 50/30/20 pattern within each phase.

### How to transition clients from Starter → Standard → Premium
- Deliver the Starter package fully and well — a client who sees real value in a small build is your easiest upsell, far easier than a cold prospect.
- 30-60 days after delivery, follow up specifically referencing what they're using daily: *"Now that the team's using [feature], a natural next step would be [Standard-tier feature] — want me to scope that?"*
- Always frame the next tier around a feature the client has already expressed wanting, not a generic "want to upgrade?" — tie the upsell to their own stated pain, the same way the original sale was anchored to lost-revenue math (Stage 4, Section 1).

---

## SECTION 11: GITHUB & REPOSITORY EXCELLENCE

### Repository structure (use on every project)
```
project-name/
├── .github/
│   ├── workflows/ci.yml
│   ├── ISSUE_TEMPLATE/{bug_report.md, feature_request.md}
│   └── pull_request_template.md
├── docs/screenshots/
├── prisma/ (or equivalent ORM/schema folder)
├── src/
├── .env.example
├── CHANGELOG.md
├── LICENSE
└── README.md
```

### README structure (template, reused every time)
```markdown
# [Project Name]
> [One-line value proposition]

[hero screenshot]

## The Problem
## Features
## Tech Stack
## Live Demo
## Screenshots
## Getting Started
## Environment Variables
## License
```

### Documentation structure
A `docs/` folder containing: screenshots, an architecture overview (one diagram + a short explanation of the Primary/Conversion/Fulfillment chain for this project), and an admin guide if the project is heading to a real client.

### Changelog strategy
Use the **Keep a Changelog** format, updated as part of every tagged release PR — never written retroactively at the end, since you'll forget the details.

### Release management & versioning
Semantic Versioning every time:
- `v0.1.0` — MVP feature-complete, internally demoable
- `v0.2.0` — next feature tier added
- `v1.0.0` — first version shown to a real prospect/pilot client
- `v1.x.y` — patches and incremental features post-launch

```bash
git tag -a v0.1.0 -m "MVP complete"
git push origin v0.1.0
gh release create v0.1.0 --generate-notes
```

### Git workflow & branching strategy
Trunk-based development, one short-lived branch per feature, even solo:
```
main                  ← always deployable
 ├─ feat/auth
 ├─ feat/dashboard
 ├─ feat/[primary-record]-management
 ├─ feat/[conversion-record]-builder
 ├─ feat/[fulfillment-record]-management
 ├─ feat/reports
 └─ feat/settings
```
Conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`) on every commit. Open a PR for every branch, even solo, and squash-merge — this is what produces a readable, professional history.

### Issue tracking, labels, milestones, project boards
- **Issue templates:** Bug Report, Feature Request
- **Labels:** `type: feature`, `type: bug`, `type: docs`, `priority: high/medium/low`, `status: blocked`
- **Milestones:** one per tagged release (`v0.1.0 — MVP`, `v0.2.0 — V2`, `v1.0.0 — Pilot Ready`)
- **Project board:** columns `Backlog → In Progress → In Review → Done`, one card per feature from the development sequence (Section 5)

### CI workflow (identical across every project, just swap test commands if the stack differs)
```yaml
name: CI
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
```
A green CI badge on every PR is the cheapest, highest-leverage signal of professionalism in the entire repo — it costs you 15 minutes to set up once and pays off on every single project after.

---

## SECTION 12: MASTER INTERNAL TOOL OPERATING SYSTEM (Condensed Quick-Reference)

This is the one-page version — once you've internalized Sections 1-11, this is the sequence you actually run every time.

### A. Opportunity Selection (run once per new industry)
1. Identify a recurring "thing flows from request to resolution" workflow currently run on spreadsheets/whiteboards
2. Validate the pain is widespread (forums, groups, competitor complaints)
3. Quantify the financial leak in dollars
4. Name the Primary/Conversion/Fulfillment entities in that industry's language

### B. Planning (run once per project)
5. Write the one-sentence problem statement
6. Define MVP/V2/Premium/Enterprise tiers
7. Define personas (decision-maker + frontline user)
8. Apply the Universal Architecture + Database Blueprint (Sections 2-3) with this industry's terminology

### C. Build (run once per project, fixed sequence — Section 5)
9. Setup project → GitHub → database → auth → layout → dashboard → Primary Record CRUD → forms → Conversion/Fulfillment chain → supporting entities → reports → settings → testing → deployment → seed data

### D. Package (run once per project — Section 9)
10. Capture the 7-shot screenshot checklist
11. Write the case study (with honest illustrative/real disclosure)
12. Record the 3-4 minute Loom
13. Polish the GitHub repo (Section 11)
14. Write the portfolio writeup and landing copy

### E. Sell (run per prospect — Section 10)
15. Discovery call — quantify their specific lost-revenue math
16. Show the live demo before discussing price
17. Propose the right tier, anchored to their dollar leak, not your hours
18. Scope of work + milestone payments in writing before starting

### F. Deliver (run per client engagement)
19. Configure terminology/branding/fields for this client (Section 8 terminology config)
20. Build within the signed scope; flag anything outside it as a change order, not a free addition
21. Deliver, document, hand over

### G. Sustain & Scale (ongoing)
22. Offer a maintenance retainer post-delivery
23. Re-skin the same core codebase for the next industry (Section 7-8) — 1-3 days, not a rebuild
24. Repeat from step B for the next vertical, reusing every template in Section 8
25. Once you have 3+ delivered client projects, start hiring/delegating the Build phase (C) and shift your own time toward Sell (E) — this is the actual transition from freelancer to agency

---

*This blueprint is a process framework, not a legal or financial document. Pricing ranges, build-time estimates, and revenue-impact figures are illustrative starting points — calibrate them against your own real build speed, your local market, and real client data as you accumulate it.*
