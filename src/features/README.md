# Features

Each subfolder is a **vertical slice** — everything about one domain entity lives
together, so a feature can be understood and changed in one place.

```
features/<feature>/
├── components/     UI specific to this feature
├── actions.ts      server actions (mutations) — auth-checked, company-scoped
├── queries.ts      server-side data reads
├── schema.ts       Zod schemas shared by client + server validation
└── types.ts        feature-local types
```

**Rules**

- `app/` routes stay thin and import from here.
- Every server action begins with an auth check and is scoped to the caller's
  company.
- One Zod schema per concern, reused on both client and server.

No features are implemented yet — these arrive in later phases (auth, dashboard,
leads, quotes, jobs, customers, reports, settings).
