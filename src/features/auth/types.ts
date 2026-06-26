import type { Role } from "@prisma/client";

/**
 * Shared authentication types (§13, §23).
 *
 * `SessionUser` is the minimal, non-sensitive projection of a `User` that is
 * safe to embed in the JWT and expose on `session.user`. It deliberately never
 * carries `passwordHash` or any other sensitive column (§7.3).
 *
 * The Auth.js module augmentation (`Session`, `User`, `JWT`) lives in
 * `src/types/next-auth.d.ts`.
 */
export type SessionUser = {
  id: string;
  organizationId: string;
  role: Role;
  name: string;
  email: string;
};

/** The four schema roles, re-exported so feature code imports them from here. */
export type { Role };

/** Roles with organization-wide (non-ownership-scoped) record access (§10). */
export const ORG_WIDE_ROLES = ["OWNER", "STAFF"] as const satisfies Role[];

/** Roles permitted to manage the team / organization settings (§10.1). */
export const OWNER_ONLY_ROLES = ["OWNER"] as const satisfies Role[];
