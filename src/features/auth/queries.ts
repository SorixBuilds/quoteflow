import { redirect } from "next/navigation";

import type { Role, User } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SessionUser } from "@/features/auth/types";

/**
 * Session / authorization helper functions (§10.3, §23). Written once and
 * imported everywhere a Server Action or Server Component needs to assert who
 * the caller is (§21 rule 9). No UI, no mutations here.
 *
 * Server-only: these call `auth()` and Prisma and must never be imported into a
 * Client Component.
 */

/** The raw session user projection, or `null` when unauthenticated. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  return {
    id: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}

/**
 * Assert an authenticated session and return its user. Redirects to `/login`
 * when there is none — safe to use as the first line of a Server Action or at
 * the top of a protected Server Component (§21 rule 5).
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/** Whether a session user holds one of the allowed roles. */
export function userHasRole(
  user: Pick<SessionUser, "role">,
  allowed: readonly Role[],
): boolean {
  return allowed.includes(user.role);
}

/**
 * Assert an authenticated session whose role is permitted. Redirects with the
 * approved insufficient-role pattern (§11.3) when the role does not qualify.
 */
export async function requireRole(allowed: readonly Role[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!userHasRole(user, allowed)) {
    redirect("/dashboard?error=insufficient-role");
  }
  return user;
}

/**
 * Authoritative re-check for sensitive writes (§7.6). Unlike {@link
 * requireSession}, which trusts the (possibly stale) JWT claims, this re-reads
 * the user from the database so a just-deactivated account — or a role that
 * changed since the token was issued — is caught at the moment it matters.
 *
 * Forces logout (redirect to `/login?reason=deactivated`) if the user no longer
 * exists or is inactive. Returns the fresh database row on success.
 */
export async function requireActiveUser(): Promise<User> {
  const sessionUser = await requireSession();
  const user = await db.user.findUnique({ where: { id: sessionUser.id } });
  if (!user || !user.isActive) {
    redirect("/login?reason=deactivated");
  }
  return user;
}
