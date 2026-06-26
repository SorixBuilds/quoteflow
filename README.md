# QuoteFlow

> A custom lead-to-job pipeline system for home service contractors — from first
> call to signed job, without anything falling through the cracks.

> **Status:** Phase 1 (project foundation) complete. Application features are not
> built yet — see the roadmap below.

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

Database (Prisma + Neon Postgres), authentication (Auth.js), PDF export
(`@react-pdf/renderer`), charts (Recharts), and tables (TanStack Table) are
introduced in their respective feature phases.

## Getting Started

```bash
npm install
cp .env.example .env   # then fill in values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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

| Variable              | Description                          | Phase |
| --------------------- | ------------------------------------ | ----- |
| `NEXT_PUBLIC_APP_URL` | Public base URL of the app           | 1     |
| `DATABASE_URL`        | Postgres connection string (Neon)    | later |
| `AUTH_SECRET`         | Auth.js session secret               | later |

## Roadmap

Auth → Layout → Dashboard → Leads → Quotes → Jobs → Customers → Reports →
Settings. See `docs/` for the full product blueprint and build plan.

## License

© 2026 Sorix Unified Systems. All rights reserved — provided for portfolio
demonstration only. See [LICENSE](./LICENSE).
