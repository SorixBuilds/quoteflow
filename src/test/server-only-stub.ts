/**
 * Test-only stub for the `server-only` package (aliased in `vitest.config.ts`).
 *
 * `server-only` is a build-time marker: in a real Next build its only job is to
 * throw if a server module is pulled into a client bundle. Under Vitest there is
 * no such bundling boundary, and the package exposes no resolvable entry for
 * Vite's resolver, so importing it fails at transform time. This empty module
 * lets server modules (which legitimately mark themselves `server-only`) be unit-
 * tested with mocked Prisma — the same way the suite already mocks `@/lib/db`.
 */
export {};
