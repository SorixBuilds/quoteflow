# QuoteFlow

> A custom lead-to-job pipeline system for home service contractors — from first
> call to signed job, without anything falling through the cracks.

> **Status:** Phases 1–3 complete (project foundation, database, authentication).
> Business features are not built yet — see the roadmap below.

## The Problem

Most home service businesses run their entire sales pipeline out of a shared
inbox, a spreadsheet, and a notebook. Leads get lost between first contact and
quote, quotes go cold with no follow-up, and the owner has no reliable view of
what's actually converting. QuoteFlow replaces that with a single visual
pipeline, a fast quote builder, and a dashboard that answers "which leads are we
winning?"

## Tech Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui (design tokens in `src/app/globals.css`)
- **State / data:** TanStack Query (server state), Zustand (UI state — added on first use)
- **Validation:** Zod
- **Notifications:** Sonner
- **Icons:** Lucide
- **Tooling:** ESLint, Prettier, Vitest, GitHub Actions CI

- **Database:** Prisma + Neon Postgres
- **Auth:** Auth.js (next-auth v5), Credentials provider, JWT sessions, bcrypt

PDF export (`@react-pdf/renderer`), charts (Recharts), and tables (TanStack
Table) are introduced in their respective feature phases.

## Getting Started

```bash
npm install
cp .env.example .env            # then fill in values
npx auth secret                 # generates AUTH_SECRET into .env (or use openssl rand -base64 32)
npm run db:migrate              # apply the Prisma schema to your database
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### First-run bootstrap

QuoteFlow has no seeded login. On a fresh database, any route sends you to
**`/setup`** — a one-time wizard that creates your organization and the first
**owner** account, then signs you in. Once an organization exists, `/setup`
becomes permanently inert (404) and everyone signs in at **`/login`**.

- New team members are added by an owner under **Settings → Team**, which issues
  a one-time temporary password to share with them.
- Password resets in this phase are manual (an owner/developer updates the
  affected user). Self-service email reset is a later phase.
- Public self-registration (`/register`) is **off by default**; enable it only
  on a public demo deployment via `ALLOW_PUBLIC_REGISTRATION=true`.

## Scripts

| Script                 | Purpose                          |
| ---------------------- | -------------------------------- |
| `npm run dev`          | Start the dev server             |
| `npm run build`        | Production build                 |
| `npm run start`        | Run the production build         |
| `npm run lint`         | ESLint                           |
| `npm run typecheck`    | TypeScript, no emit              |
| `npm run format`       | Prettier (write)                 |
| `npm run format:check` | Prettier (check only)            |
| `npm run test`         | Vitest (run once)                |
| `npm run test:watch`   | Vitest (watch)                   |

## Project Structure

```
src/
├── app/            App Router routes + root layout (thin)
├── components/
│   ├── ui/         shadcn/ui primitives
│   └── shared/     cross-feature composite components
├── features/       vertical slices (one folder per domain entity)
├── providers/      app-wide React providers
├── hooks/          reusable hooks
├── lib/            infrastructure + utilities (cn, env)
├── config/         static app configuration
└── types/          shared types
```

## Environment Variables

| Variable                    | Description                                                            | Required | Phase |
| --------------------------- | --------------------------------------------------------------------- | -------- | ----- |
| `NEXT_PUBLIC_APP_URL`       | Public base URL of the app                                            | Yes      | 1     |
| `DATABASE_URL`              | Postgres connection string (Neon)                                    | Yes      | 2     |
| `AUTH_SECRET`               | Signs/encrypts the JWT session cookie — unique per environment        | Yes      | 3     |
| `ALLOW_PUBLIC_REGISTRATION` | Enables `/register`. Defaults to `false`; `true` only on public demo  | Yes      | 3     |
| `BCRYPT_COST_FACTOR`        | bcrypt work factor. Optional — defaults to `12`                       | No       | 3     |

## Roadmap

Auth → Layout → Dashboard → Leads → Quotes → Jobs → Customers → Reports →
Settings. See `docs/` for the full product blueprint and build plan.

## License

© 2026 Sorix Unified Systems. All rights reserved — provided for portfolio
demonstration only. See [LICENSE](./LICENSE).
