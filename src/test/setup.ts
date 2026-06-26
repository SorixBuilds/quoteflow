import "@testing-library/jest-dom/vitest";

// Provide dummy values for the variables `src/lib/env.ts` requires, so any
// module that transitively imports the validated env (e.g. lib/password.ts)
// loads under test without a real .env. Tests mock the Prisma client, so no
// live database connection is ever opened from this URL.
process.env.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/test?sslmode=disable";
process.env.AUTH_SECRET ??= "test-secret-not-used-for-real-sessions";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
