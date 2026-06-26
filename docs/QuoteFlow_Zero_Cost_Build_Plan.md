# QuoteFlow — Zero-Cost Implementation Plan
### From Empty Windows Machine to Deployed Portfolio Project — $0/month

This plan is the execution-ready version of the QuoteFlow blueprint, rebuilt around a **$0-cost stack**. Every tool below is either open-source or has a free tier with no card required for V1. Paid services (Sentry, Resend, Vercel Blob) are deliberately deferred until there's a real client or real users — see Part 15.

---

## PART 0 — THE ZERO-COST STACK DECISION

### Final V1 Stack
```
Next.js          — framework (frontend + backend in one)
TypeScript        — type safety
Tailwind CSS      — styling
shadcn/ui         — UI components
PostgreSQL (Neon) — database (free tier)
Prisma            — ORM / migrations
Auth.js           — authentication
Git + GitHub      — version control / portfolio hosting
Vercel            — deployment (free tier)
```

### Supporting libraries (also fully free, no tier limits — kept in V1)
```
TanStack Query    — server state / caching
Zustand           — small UI state (sidebar, modals)
React Hook Form   — forms
Zod               — validation
TanStack Table    — leads/quotes/reports tables
Recharts          — KPI + ROI charts
Lucide React      — icons
Sonner            — toast notifications
@react-pdf/renderer — quote PDF export (generates PDFs server-side, no third-party cost)
```

### Deliberately SKIPPED in V1 (added later — see Part 15)
| Tool | Why skipped now | Replaced with |
|---|---|---|
| **Sentry** | No real users yet to monitor | Console logging + manual testing |
| **Resend** (real emails) | Free tier has sending limits, not needed yet | "Quote Sent" = a database status flip, no email actually sent |
| **Vercel Blob** (file uploads) | Free tier has storage limits, not needed yet | Company logo stored as a pasted **URL** (text field), not an uploaded file |
| **Forgot Password (email-based)** | Requires Resend to send the reset link | Deferred to V2 — for now, password resets are done manually since you control all demo/test accounts |

**Total monthly cost for the entire build, demo, and portfolio phase: $0.**

You will only need to spend money once you have a real paying client who needs: high email volume, file uploads, error monitoring at scale, or heavy database usage. None of that applies to a portfolio project.

---

## PART 1 — DEVELOPMENT ENVIRONMENT SETUP (Absolute Zero Start)

### Step 1: Install VS Code
1. Download from https://code.visualstudio.com → run the Windows installer.
2. During install, check **"Add to PATH."**
3. **Verify:**
```
code --version
```
**Common mistake:** Skipping the PATH checkbox — `code .` won't work later. Fix: reinstall and check it, or restart your PC.

### Step 2: Install Node.js (LTS)
1. Download the **LTS** version from https://nodejs.org (not "Current").
2. Run installer, accept defaults.
3. **Verify:**
```
node --version
npm --version
```
**Common mistake:** Installing "Current" instead of "LTS" — some packages aren't tested against it yet.

### Step 3: Install Git
1. Download from https://git-scm.com/download/win → run installer.
2. When prompted for default editor, choose **"Use Visual Studio Code as Git's default editor."**
3. **Verify:**
```
git --version
```

### Step 4: Configure Git
```bash
git config --global user.name "Your Name"
git config --global user.email "your-github-email@example.com"
git config --global init.defaultBranch main
git config --global core.autocrlf true
```
- `user.name` / `user.email` must match your GitHub account so commits show your name/avatar.
- `init.defaultBranch main` avoids the legacy `master` naming.
- `core.autocrlf true` is a Windows-specific fix for line-ending diffs.

**Verify:**
```bash
git config --list
```

### Step 5: Create a GitHub account
1. Sign up at https://github.com/signup with a professional username (clients will see this).
2. Enable 2FA (Settings → Password and authentication).
3. Install GitHub CLI:
```
winget install --id GitHub.cli
```
**Verify:**
```bash
gh --version
gh auth login
```

### Step 6: Install VS Code extensions
```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension Prisma.prisma
code --install-extension bradlc.vscode-tailwindcss
code --install-extension eamodio.gitlens
code --install-extension usernamehw.errorlens
code --install-extension yoavbls.pretty-ts-errors
```

### Step 7: Create the project
```bash
cd C:\Dev
npx create-next-app@latest quoteflow
```
Prompts: TypeScript **Yes**, ESLint **Yes**, Tailwind **Yes**, `src/` directory **Yes**, App Router **Yes**, import alias **Yes (default)**.

```bash
cd quoteflow
code .
npm run dev
```
**Verify:** `http://localhost:3000` loads the starter page.

### Step 8: First commit
```bash
type .gitignore        # confirm .env* is listed — never skip this check
git init
git add .
git commit -m "chore: initial commit from create-next-app"
```

### Step 9: Connect to GitHub
```bash
gh repo create quoteflow --private --source=. --remote=origin --push
```
**Verify:** Refresh the repo page on GitHub — your files appear.

> Keep the repo **private** until Part 14 (README, screenshots, polish) is done.

### Step 10: Environment file
```bash
echo. > .env
git check-ignore -v .env
```
Must print a match. If it prints nothing, **stop and fix `.gitignore` before continuing.**

### Setup Checklist
- [ ] `code/node/npm/git/gh --version` all return values
- [ ] `git config --list` shows correct name/email
- [ ] GitHub account + 2FA enabled
- [ ] Extensions installed
- [ ] `npm run dev` works
- [ ] Repo pushed to GitHub
- [ ] `.env` confirmed git-ignored

---

## PART 2 — GIT & GITHUB WORKFLOW

### Branching strategy
```
main                      ← always deployable, auto-deploys to Vercel
 ├─ feat/auth
 ├─ feat/dashboard-layout
 ├─ feat/lead-management
 ├─ feat/quote-builder
 ├─ feat/job-management
 ├─ feat/customer-db
 ├─ feat/reports
 ├─ feat/settings
 └─ fix/...
```
Never commit directly to `main`. One branch per feature, even solo.

### Commit convention (Conventional Commits)
```
feat(scope): description
fix(scope): description
chore: description
docs: description
refactor(scope): description
test: description
```

### Daily workflow
```bash
git checkout -b feat/lead-management
# ...work, commit in small logical chunks...
git push -u origin feat/lead-management
gh pr create --fill
gh pr merge --squash --delete-branch
git checkout main && git pull
```

### Release tagging
```bash
git tag -a v0.1.0 -m "MVP: auth, pipeline, quote builder, dashboard"
git push origin v0.1.0
gh release create v0.1.0 --generate-notes
```

### Recommended full commit history
```
chore: initial commit from create-next-app
chore: configure ESLint + Prettier
chore(db): add Prisma, connect Neon Postgres
feat(db): define Company, User, Lead, Quote, Job, Customer schema
feat(db): add Activities, Tasks, Notes, LeadSources tables
chore(db): initial migration

feat(auth): implement Auth.js credentials provider
feat(auth): add registration flow with company creation
feat(auth): add role-based session (Owner/Manager/Rep/Tech)
feat(auth): add middleware route protection by role

feat(layout): build persistent sidebar + topbar shell
feat(layout): add design tokens to Tailwind config
feat(ui): add shadcn/ui base components

feat(dashboard): add KPI card row
feat(dashboard): add pipeline kanban board
feat(dashboard): add lead-source ROI chart
feat(dashboard): add recent activity feed

feat(leads): add lead list table with filters
feat(leads): add manual lead creation form
feat(leads): add public lead-capture form endpoint
feat(leads): add lead detail view with activity timeline
fix(leads): correct status transition validation

feat(quotes): add quote builder with line-item templates
feat(quotes): add PDF export via react-pdf
feat(quotes): add quote status tracking (sent/viewed/accepted/declined)
feat(quotes): convert accepted quote into Job
fix(quotes): resolve totals rounding bug

feat(jobs): add job list + status board
feat(jobs): add technician assignment
feat(jobs): add mobile-optimized technician view

feat(customers): add customer database + lifetime value calc
feat(customers): link customer history to leads/quotes/jobs

feat(reports): add conversion rate + turnaround time reports
feat(reports): add lead-source ROI breakdown

feat(settings): add company settings, team management, role editing

test: add unit tests for quote total calculations
test: add e2e test for lead-to-job pipeline flow

chore(ci): add GitHub Actions lint + test workflow
docs: write README with screenshots and setup guide
chore: add CHANGELOG.md

chore(release): tag v0.1.0 MVP
chore(deploy): configure Vercel production environment
```

---

## PART 3 — PROJECT STRUCTURE

```
quoteflow/
├── .github/
│   ├── workflows/ci.yml
│   └── ISSUE_TEMPLATE/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (auth)/register/page.tsx
│   │   ├── (dashboard)/layout.tsx
│   │   ├── (dashboard)/dashboard/page.tsx
│   │   ├── (dashboard)/leads/page.tsx
│   │   ├── (dashboard)/leads/[id]/page.tsx
│   │   ├── (dashboard)/quotes/page.tsx
│   │   ├── (dashboard)/quotes/[id]/page.tsx
│   │   ├── (dashboard)/jobs/page.tsx
│   │   ├── (dashboard)/customers/page.tsx
│   │   ├── (dashboard)/reports/page.tsx
│   │   ├── (dashboard)/settings/page.tsx
│   │   ├── api/lead-capture/route.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/              # shadcn primitives
│   │   └── shared/          # EmptyState, PageHeader, etc.
│   ├── features/
│   │   ├── leads/{components,actions.ts,queries.ts,schema.ts}
│   │   ├── quotes/
│   │   ├── jobs/
│   │   ├── customers/
│   │   ├── dashboard/
│   │   └── auth/
│   ├── hooks/
│   ├── lib/
│   │   ├── db.ts            # Prisma client singleton
│   │   ├── auth.ts          # Auth.js config
│   │   └── pdf/             # quote PDF templates
│   ├── utils/
│   └── styles/globals.css
├── .env.example
├── .gitignore
├── README.md
├── CHANGELOG.md
└── package.json
```

**Rules:**
- `app/` = routing only, thin pages that import from `features/`
- `features/<entity>/` = vertical slice (everything about Leads in one folder)
- `lib/` = infrastructure singletons only
- PascalCase components, camelCase functions, kebab-case routes

---

## PART 4 — DATABASE ARCHITECTURE (Prisma + Neon)

### Setting up Neon (free tier)
1. https://neon.tech → sign up free (GitHub login works) → create a project called `quoteflow-dev`.
2. Copy the connection string → paste into `.env` as `DATABASE_URL`.
3. Install Prisma:
```bash
npm install prisma @prisma/client
npx prisma init
```

### Full schema (`prisma/schema.prisma`)
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role { OWNER OFFICE_MANAGER SALES_REP TECHNICIAN }
enum LeadStatus { NEW CONTACTED QUOTED WON LOST }
enum QuoteStatus { DRAFT SENT VIEWED ACCEPTED DECLINED EXPIRED }
enum JobStatus { SCHEDULED IN_PROGRESS COMPLETED CANCELLED }
enum InvoiceStatus { UNPAID PARTIAL PAID }

model Company {
  id               String   @id @default(cuid())
  name             String
  industryVertical String
  logoUrl          String?  // pasted URL — no file upload needed in V1
  settingsJson     Json     @default("{}")
  createdAt        DateTime @default(now())
  users            User[]
  leads            Lead[]
  leadSources      LeadSource[]
  customers        Customer[]
}

model User {
  id           String   @id @default(cuid())
  companyId    String
  company      Company  @relation(fields: [companyId], references: [id])
  name         String
  email        String   @unique
  passwordHash String
  role         Role
  createdAt    DateTime @default(now())
  assignedLeads Lead[]  @relation("AssignedLeads")
  assignedJobs  Job[]   @relation("AssignedTechnician")

  @@index([companyId])
}

model LeadSource {
  id          String  @id @default(cuid())
  companyId   String
  company     Company @relation(fields: [companyId], references: [id])
  name        String
  costPerLead Decimal @default(0) @db.Decimal(10, 2)
  leads       Lead[]

  @@index([companyId])
}

model Lead {
  id           String     @id @default(cuid())
  companyId    String
  company      Company    @relation(fields: [companyId], references: [id])
  name         String
  phone        String
  email        String?
  sourceId     String?
  source       LeadSource? @relation(fields: [sourceId], references: [id])
  status       LeadStatus @default(NEW)
  assignedToId String?
  assignedTo   User?      @relation("AssignedLeads", fields: [assignedToId], references: [id])
  lostReason   String?
  customerId   String?
  customer     Customer?  @relation(fields: [customerId], references: [id])
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  quotes       Quote[]
  activities   Activity[]
  notes        Note[]
  tasks        Task[]

  @@index([companyId, status])
  @@index([assignedToId])
}

model Customer {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id])
  name          String
  address       String?
  phone         String
  email         String?
  lifetimeValue Decimal  @default(0) @db.Decimal(10, 2)
  createdAt     DateTime @default(now())
  leads         Lead[]
  jobs          Job[]
  notes         Note[]

  @@index([companyId])
}

model Quote {
  id        String      @id @default(cuid())
  leadId    String
  lead      Lead        @relation(fields: [leadId], references: [id])
  jobType   String
  lineItems LineItem[]
  subtotal  Decimal     @db.Decimal(10, 2)
  tax       Decimal     @db.Decimal(10, 2)
  total     Decimal     @db.Decimal(10, 2)
  status    QuoteStatus @default(DRAFT)
  sentAt    DateTime?
  viewedAt  DateTime?
  acceptedAt DateTime?
  expiresAt DateTime?
  createdAt DateTime    @default(now())
  job       Job?

  @@index([leadId, status])
}

model LineItem {
  id          String  @id @default(cuid())
  quoteId     String
  quote       Quote   @relation(fields: [quoteId], references: [id], onDelete: Cascade)
  description String
  quantity    Decimal @db.Decimal(10, 2)
  unitPrice   Decimal @db.Decimal(10, 2)
  total       Decimal @db.Decimal(10, 2)

  @@index([quoteId])
}

model Job {
  id              String    @id @default(cuid())
  quoteId         String    @unique
  quote           Quote     @relation(fields: [quoteId], references: [id])
  customerId      String
  customer        Customer  @relation(fields: [customerId], references: [id])
  technicianId    String?
  technician      User?     @relation("AssignedTechnician", fields: [technicianId], references: [id])
  scheduledDate   DateTime?
  status          JobStatus @default(SCHEDULED)
  completionNotes String?
  invoice         Invoice?

  @@index([technicianId, status])
}

model Invoice {
  id        String        @id @default(cuid())
  jobId     String        @unique
  job       Job           @relation(fields: [jobId], references: [id])
  amount    Decimal       @db.Decimal(10, 2)
  status    InvoiceStatus @default(UNPAID)
  paidAt    DateTime?
  createdAt DateTime      @default(now())
}

model Activity {
  id        String   @id @default(cuid())
  leadId    String
  lead      Lead     @relation(fields: [leadId], references: [id])
  type      String
  note      String?
  createdBy String
  createdAt DateTime @default(now())

  @@index([leadId, createdAt])
}

model Note {
  id         String    @id @default(cuid())
  leadId     String?
  lead       Lead?     @relation(fields: [leadId], references: [id])
  customerId String?
  customer   Customer? @relation(fields: [customerId], references: [id])
  content    String
  createdBy  String
  createdAt  DateTime  @default(now())
}

model Task {
  id         String    @id @default(cuid())
  leadId     String?
  lead       Lead?     @relation(fields: [leadId], references: [id])
  title      String
  dueAt      DateTime?
  completed  Boolean   @default(false)
  assignedTo String?
  createdAt  DateTime  @default(now())
}
```

### Run the first migration
```bash
npx prisma migrate dev --name init
npx prisma studio        # opens a free local GUI to inspect your data
```

**Why `logoUrl` is a plain string field:** instead of building file upload (which would need Vercel Blob), the Settings screen has a simple text input — "Paste your logo image URL." Zero cost, zero storage limits, ships in V1.

---

## PART 5 — AUTHENTICATION (Auth.js, fully free, no Resend needed for V1)

### Implementation order
1. **Registration** — creates `Company` + first `User` (role `OWNER`)
2. **Login** — Auth.js credentials provider, bcrypt password check, JWT session carrying `role` + `companyId`
3. **Protected routes** — `middleware.ts` redirects unauthenticated users; redirects role-mismatched users
4. **Password reset — deferred to V2.** For V1, you control every demo/test account, so a forgotten password is solved by directly updating `passwordHash` in `prisma studio` or re-seeding. No email infrastructure needed yet.

```bash
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

### Role → access map
```ts
const ROLE_ACCESS: Record<Role, string[]> = {
  OWNER:          ["*"],
  OFFICE_MANAGER: ["/dashboard", "/leads", "/quotes", "/jobs", "/customers"],
  SALES_REP:      ["/dashboard", "/leads", "/quotes"],
  TECHNICIAN:     ["/jobs/mobile"],
};
```
**Critical:** enforce this at **both** the middleware level (route access) and inside every server action (record-level — e.g., a Sales Rep's query must filter `assignedToId = session.userId`).

---

## PART 6 — FEATURE DEVELOPMENT ROADMAP (Phase by Phase)

### Phase 1 — Authentication
- Branch: `feat/auth`
- Files: `lib/auth.ts`, `app/(auth)/login`, `app/(auth)/register`, `middleware.ts`, `features/auth/actions.ts`
- DB: `Company`, `User`
- Testing: [ ] Unauthenticated redirect works [ ] Wrong password rejected [ ] Role embedded in session correctly

### Phase 2 — Layout
- Branch: `feat/dashboard-layout`
- Files: `app/(dashboard)/layout.tsx`, `Sidebar.tsx`, `Topbar.tsx`, shadcn/ui init
- Testing: [ ] Nav items match role [ ] Responsive collapse on mobile

### Phase 3 — Dashboard
- Branch: `feat/dashboard-kpis`
- Files: `features/dashboard/*`
- Testing: [ ] KPIs match manual count on seed data [ ] Empty state on zero leads

### Phase 4 — Lead Management
- Branch: `feat/lead-management`
- Files: `features/leads/*`, `app/api/lead-capture/route.ts`
- DB: `Lead`, `LeadSource`, `Activity`
- Testing: [ ] Kanban drag persists status [ ] Public form creates a lead [ ] Rep only sees own leads

### Phase 5 — Quote Management
- Branch: `feat/quote-builder`
- Files: `features/quotes/*`, `lib/pdf/QuoteDocument.tsx`
- DB: `Quote`, `LineItem`
- **Note on "Send Quote":** clicking "Send" sets `status = SENT` and `sentAt = now()` in the database. It does **not** trigger a real email in V1 — it simulates the workflow exactly as a real system would, just without the email leg. The PDF itself is still fully generated and downloadable via `@react-pdf/renderer` (which is free, no third-party dependency).
- Testing: [ ] Totals recalc live [ ] PDF matches on-screen total [ ] Accepting a quote creates exactly one Job

### Phase 6 — Job Management
- Branch: `feat/job-management`
- Files: `features/jobs/*`
- DB: `Job`, `Invoice`
- Testing: [ ] Technician sees only assigned jobs [ ] "Mark Complete" updates status

### Phase 7 — Customer Management
- Branch: `feat/customer-db`
- Testing: [ ] Lifetime value recalculates correctly [ ] History links work

### Phase 8 — Reports
- Branch: `feat/reports`
- Testing: [ ] ROI math matches manual calculation on seed data

### Phase 9 — Settings
- Branch: `feat/settings`
- Includes the `logoUrl` text-input field (no file upload)
- Testing: [ ] Only Owner can change roles [ ] Logo URL updates topbar immediately

---

## PART 7 — SCREEN-BY-SCREEN BUILD GUIDE

### Dashboard
- **Purpose:** weekly business-health snapshot — your strongest portfolio screenshot
- **Components:** KPI cards ×5, pipeline kanban, lead-source ROI chart, activity feed
- **Empty state:** "No leads yet — connect your website form or add one manually"
- **Loading state:** skeleton cards
- **Error state:** inline retry banner, never a blank page

### Leads (List + Detail)
- **List:** filterable/sortable table (TanStack Table), "+ New Lead" modal
- **Detail:** activity timeline, notes, linked quotes, status dropdown, "Mark Lost" requires a reason
- **Validation:** name + phone required (Zod, shared client/server)
- **Empty state:** "No leads match this filter"

### Quotes (List + Builder)
- **List:** status badges (Draft/Sent/Viewed/Accepted/Declined/Expired)
- **Builder:** line-item editor, template picker, live totals, **"Send" button flips DB status** (no email), "Download PDF" button generates the real file
- **Validation:** at least one line item; totals always recalculated server-side, never trusted from the client
- **Empty state:** new quote starts with zero line items + "Add from template"

### Jobs
- **Components:** status board, technician assign dropdown, schedule date picker
- **Validation:** can't mark complete without a scheduled date
- **Empty state:** "Jobs appear automatically when a quote is accepted"

### Customers
- **Components:** table + detail panel showing linked leads/quotes/jobs and lifetime value
- **Validation:** phone or email required

### Reports
- **Components:** ROI chart, conversion rate card, turnaround time card, date range picker
- **Empty state:** "Reports populate as leads move through your pipeline"

### Settings
- **Components:** company profile form (including the logo URL field), team table, lead source manager
- **Validation:** only Owner can edit roles; can't remove the last Owner

---

## PART 8 — UI SYSTEM (Free: Tailwind + shadcn/ui)

```js
// tailwind.config.ts — design tokens
colors: {
  primary: "#16243B",  // navy — sidebar/headers
  accent:  "#F2994A",  // amber — primary CTAs only
  success: "#2BA84A",  // won
  danger:  "#E5484D",  // lost
  warning: "#F2994A",  // pending/expiring
}
```
- Typography: Inter or Manrope, max 2 sizes per region
- Spacing: strict 8px grid
- Cards: `rounded-lg`, soft shadow, 1px border
- Buttons: navy = default, amber = the one primary action per screen
- Badges: pill-shaped, light tint background + semantic text color
- Every component starts from a shadcn/ui primitive, customized via Tailwind — never a one-off styled component

---

## PART 9 — API ARCHITECTURE (Server Actions — no separate backend needed)

```ts
// features/leads/actions.ts
"use server";
export async function createLead(input: CreateLeadInput) {
  const session = await requireSession();
  const parsed = createLeadSchema.parse(input);
  const lead = await db.lead.create({
    data: { ...parsed, companyId: session.companyId },
  });
  await db.activity.create({
    data: { leadId: lead.id, type: "created", createdBy: session.userId },
  });
  revalidatePath("/leads");
  return lead;
}
```
**Conventions:**
- Every server action starts with an auth check and is company-scoped
- One shared Zod schema per feature, used client + server
- The only real HTTP route handler is `/api/lead-capture` (public, rate-limited) since it needs to accept submissions from an external `<form>`

---

## PART 10 — TESTING STRATEGY (Free tools only)

| Layer | Tool | Covers |
|---|---|---|
| Unit | Vitest | `calculateQuoteTotal()`, `calculateLifetimeValue()` |
| Integration | Vitest + Prisma test DB | "Accepting a quote creates exactly one Job" |
| Component | React Testing Library | Form validation, empty/loading states |
| E2E | Playwright | Full register → lead → quote → job flow |

### Manual QA checklist (before every tagged release)
- [ ] Every screen tested at all 4 roles
- [ ] Every list tested with 0, 1, and 50+ records
- [ ] Forms tested with invalid input
- [ ] Mobile technician view tested on a real phone
- [ ] PDF totals match on-screen totals exactly

---

## PART 11 — DEPLOYMENT (Free tier only)

### Step 1 — Production database
1. Neon → create a **separate production project** (`quoteflow-prod`).
2. Copy its connection string.

### Step 2 — Environment variables (V1 — minimal)
```
DATABASE_URL=
AUTH_SECRET=
NEXT_PUBLIC_APP_URL=
```
No `RESEND_API_KEY`, no `BLOB_READ_WRITE_TOKEN`, no `SENTRY_DSN` needed yet.

### Step 3 — Hosting (Vercel free tier)
1. vercel.com → Import Git Repository → select `quoteflow`.
2. Add the 3 env vars above (Production + Preview scopes).
3. Vercel auto-detects Next.js — deploy.
4. Every PR automatically gets a free Preview Deployment URL — useful for demo links before merging.

### Step 4 — Migrate production database
```bash
npx prisma migrate deploy
```

### Step 5 — Domain (optional, can also skip and use the free `*.vercel.app` URL)
If you want a custom domain later: buy one, point DNS to Vercel, SSL is automatic and free.

### Deployment checklist
- [ ] All 3 env vars set in Vercel
- [ ] Production migration run and verified
- [ ] App loads on the live Vercel URL
- [ ] `main` branch protected (require PR before merge)

---

## PART 12 — SEED DATA FOR DEMO

Create `prisma/seed.ts` generating the Apex Home Services demo dataset:
- 1 Company (Apex Home Services, vertical = HVAC/Plumbing)
- 3 Users: Dave (Owner), Maria (Office Manager), Mike (Technician)
- ~25 Leads across sources (Google Ads, Yelp, Referral, Repeat Customer)
- Mixed statuses (new, quoted, won, lost) so the pipeline and reports look lived-in
- A handful of Quotes in different statuses (sent/viewed/accepted) and resulting Jobs

```bash
npx prisma db seed
```
Re-run this on every fresh deploy so your demo is always reproducible.

---

## PART 13 — PORTFOLIO PREPARATION

- **Demo scenarios:** lead arrives → drag through pipeline → build & "send" a quote → status flips sent→viewed→accepted → dashboard reveals ROI → mobile technician marks a job complete
- **Screenshot checklist:**
  1. Dashboard (KPI row + kanban) — hero shot
  2. Lead detail with activity timeline
  3. Quote builder mid-edit
  4. Quote status progression (sent → viewed → accepted)
  5. Lead-source ROI chart
  6. Mobile technician "today's jobs" view
  7. An empty state (shows design polish)
- **Loom walkthrough:** 3-4 minutes — hook → pipeline → quote builder → dashboard payoff → close
- **Presentation structure:** Problem (with lost-revenue math) → System (screenshots) → ROI payoff chart → What I build for you → Pricing & next step

---

## PART 14 — GITHUB & REPOSITORY EXCELLENCE

### Final repo structure
```
quoteflow/
├── .github/
│   ├── workflows/ci.yml
│   ├── ISSUE_TEMPLATE/{bug_report.md, feature_request.md}
│   └── pull_request_template.md
├── docs/screenshots/
├── prisma/
├── src/
├── .env.example
├── CHANGELOG.md
├── LICENSE
└── README.md
```

### README structure
```markdown
# QuoteFlow
> Custom lead-to-job pipeline system for home service contractors.

[dashboard screenshot]

## The Problem
[1-2 sentences]

## Features
- Visual lead pipeline
- Quote builder with PDF export + status tracking
- Lead-source ROI dashboard
- Mobile-optimized technician view

## Tech Stack
Next.js · TypeScript · PostgreSQL (Neon) · Prisma · Auth.js · Tailwind · shadcn/ui

## Live Demo
[link] — demo credentials: ...

## Screenshots
[gallery]

## Getting Started
\`\`\`bash
git clone ...
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma db seed
npm run dev
\`\`\`

## Environment Variables
| Variable | Description |
|---|---|
| DATABASE_URL | Postgres connection string (Neon) |
| AUTH_SECRET  | Auth.js session secret |

## License
[see note below]
```

> **Licensing note:** if you plan to sell custom builds of this, avoid MIT (which permits resale by anyone). Use a "© Year, All Rights Reserved — for portfolio demonstration only" notice instead.

### CHANGELOG.md (Keep a Changelog format)
```markdown
## [0.1.0] - YYYY-MM-DD
### Added
- Authentication with role-based access
- Lead pipeline kanban
- Quote builder with PDF export
- Dashboard KPIs and lead-source ROI chart
```

### GitHub Project board
Columns: `Backlog → In Progress → In Review → Done`, one card per feature phase from Part 6.

### Labels
| Label | Meaning |
|---|---|
| `type: feature` | New capability |
| `type: bug` | Defect |
| `type: docs` | Documentation |
| `priority: high/medium/low` | Urgency |

### Milestones
`v0.1.0 — MVP`, `v0.2.0 — V2 Features`, `v1.0.0 — Pilot Ready`

### CI workflow (`.github/workflows/ci.yml`)
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
A green CI check on every PR is the single biggest "professional software" signal in the repo.

---

## PART 15 — WHAT TO ADD LATER (Only When You Have Real Users/Clients)

Don't add these until they're actually needed — adding them now adds cost and complexity with zero benefit at the portfolio stage.

| When this happens... | ...add this |
|---|---|
| You get a real pilot client who needs actual emails sent (quote delivery, password reset) | **Resend** (free tier covers low volume; upgrade only if volume grows) |
| Clients want to upload their own logo/photos instead of pasting a URL | **Vercel Blob** (free tier covers light usage) |
| The app has real users and you need to know about production errors | **Sentry** (free tier covers small projects) |
| Your Neon database grows past the free tier limits (real client data volume) | **Neon paid tier** |
| Your Vercel traffic grows past the free tier limits | **Vercel Pro** |

**The upgrade path requires no rework** — Auth.js, Prisma, and the server-action architecture don't change when you add these. You're only adding new integrations on top of a stack that was already built correctly.

---

## PART 16 — EXACT SEQUENTIAL BUILD ORDER

1. Install VS Code
2. Install Node.js (LTS)
3. Install Git, configure name/email/defaultBranch/autocrlf
4. Create GitHub account, enable 2FA, install + auth GitHub CLI
5. Install VS Code extensions
6. `npx create-next-app@latest quoteflow` (TS, Tailwind, App Router, `src/`)
7. `npm run dev` → verify localhost:3000
8. `git init` → confirm `.env` ignored → first commit
9. `gh repo create quoteflow --private --source=. --remote=origin --push`
10. Create Neon dev project → add `DATABASE_URL` to `.env`
11. Install Prisma → write schema (Part 4) → `npx prisma migrate dev --name init`
12. Branch `feat/auth` → build registration/login/middleware (no Resend, no forgot-password yet) → PR → merge
13. Branch `feat/dashboard-layout` → shadcn/ui init, sidebar/topbar, design tokens → PR → merge
14. Branch `feat/dashboard-kpis` → KPI cards, kanban, ROI chart, activity feed → PR → merge
15. Branch `feat/lead-management` → leads list, detail, public capture endpoint → PR → merge
16. Branch `feat/quote-builder` → line-item editor, react-pdf export, "Send" = DB status flip → PR → merge
17. Branch `feat/job-management` → job board, technician assignment, mobile view → PR → merge
18. Branch `feat/customer-db` → customer table, history, lifetime value → PR → merge
19. Branch `feat/reports` → conversion/turnaround/ROI reports → PR → merge
20. Branch `feat/settings` → company profile (logo URL field), team/roles, lead sources → PR → merge
21. Tag `v0.1.0` (MVP complete)
22. Write unit/integration tests (Vitest) for quote totals, status transitions, job creation
23. Write Playwright E2E for the full flow
24. Add GitHub Actions CI → confirm green on next PR
25. Write `prisma/seed.ts` for the Apex Home Services demo dataset
26. Create Neon **production** project → `npx prisma migrate deploy`
27. Deploy to Vercel (free tier) → add 3 env vars → confirm live URL works
28. Run full manual QA checklist against the production URL
29. Capture all 7 portfolio screenshots, record the 3-4 minute Loom walkthrough
30. Write README, CHANGELOG, set up Issues/Labels/Milestones/Project board
31. Flip repository from private to public
32. Tag `v1.0.0`, publish GitHub Release with notes
33. Build the portfolio presentation deck (Problem → System → ROI payoff → Pricing)
34. **Only once you have a real pilot client:** add Resend (real email + forgot-password), Vercel Blob (logo upload), Sentry (error monitoring) per Part 15

---

*Total cost to reach a fully deployed, demo-ready, publicly hosted portfolio project following this plan: $0/month.*
