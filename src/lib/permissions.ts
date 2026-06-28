import type { SessionUser } from "@/features/auth/types";
import {
  getCurrentUser,
  requireActiveUser,
  requireRole,
  requireSession,
  userHasRole,
} from "@/features/auth/queries";

/**
 * Permission & tenant helper module (Phase 4, Step 1 — §3.10, §13).
 *
 * This is the formalized, single import surface every Server Action and
 * Server Component uses to assert "who is the caller, and is this data theirs
 * to see." The Phase 3 helpers (`requireSession`, `requireRole`,
 * `requireActiveUser`) are re-exported unchanged so existing call sites keep
 * working and new code has one canonical place to import them from. Phase 4
 * adds exactly one new helper — `requireCompanyScope()` — and no new roles or
 * permission primitives (frozen permission model).
 *
 * Tenant terminology note: the Phase 4 architecture refers to the tenant as the
 * "company" (hence `requireCompanyScope`), but the frozen Phase 2 schema models
 * the tenant as `Organization` with an `organizationId` column on every
 * tenant-owned table. This helper therefore returns `{ organizationId }`, which
 * spreads directly into a Prisma `where` clause.
 *
 * Server-only: these call `auth()` and Prisma and must never be imported into a
 * Client Component.
 */

export { getCurrentUser, requireActiveUser, requireRole, requireSession, userHasRole };

/** The tenant scope returned by {@link requireCompanyScope}. */
export type CompanyScope = {
  /** The frozen Phase 2 tenant key — spread directly into a Prisma `where`. */
  organizationId: string;
};

/**
 * Assert an authenticated session and return the tenant scope to constrain
 * every company-scoped query (§13). Pass an already-resolved session to avoid a
 * second `auth()` round-trip when the action has already called
 * `requireSession()`; otherwise this resolves the session itself.
 *
 * Usage:
 * ```ts
 * const { organizationId } = await requireCompanyScope(session);
 * await db.lead.findMany({ where: { organizationId } });
 * ```
 */
export async function requireCompanyScope(
  session?: Pick<SessionUser, "organizationId">,
): Promise<CompanyScope> {
  const resolved = session ?? (await requireSession());
  return { organizationId: resolved.organizationId };
}
