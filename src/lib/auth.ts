import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { runDummyComparison, verifyPassword } from "@/lib/password";
import { loginSchema } from "@/features/auth/schema";

/**
 * Auth.js (next-auth v5) configuration — and nothing else (§21 rule 8).
 *
 * Strategy: Credentials provider + JWT sessions (§4, §7, §8). No database
 * session table and no Auth.js Prisma adapter are needed for the JWT strategy;
 * authentication reads the existing frozen `User`/`Organization` models
 * directly via the Prisma singleton.
 *
 * Edge note: this module imports Prisma and therefore runs on the Node.js
 * runtime. `middleware.ts` is pinned to the Node runtime so it can import the
 * `auth` helper exported here without bundling Prisma for the Edge runtime.
 */

/** 7-day absolute session lifetime with rolling renewal (§8.3). */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/** Minimal, non-sensitive user projection returned on a successful login. */
export type AuthorizedUser = {
  id: string;
  organizationId: string;
  role: Role;
  isActive: boolean;
  name: string;
  email: string;
};

/**
 * Verify submitted credentials against the existing `User` table (§6.1).
 * Extracted from the provider so this security-critical logic is unit-testable.
 *
 * Every failure branch returns `null` with the SAME outcome and runs a bcrypt
 * comparison first, so unknown-email, wrong-password, inactive-account, and
 * no-password-set are indistinguishable by message or by timing (§9.7, §15
 * user-enumeration prevention).
 */
export async function authorizeCredentials(
  credentials: unknown,
): Promise<AuthorizedUser | null> {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) {
    const rawPassword = (credentials as { password?: unknown })?.password;
    await runDummyComparison(
      typeof rawPassword === "string" ? rawPassword : "",
    );
    return null;
  }

  const { email, password } = parsed.data;

  // Email is unique per (organizationId, email), not globally (§27 addendum).
  // For the delivered single-org deployment there is exactly one match;
  // `orderBy` keeps multi-org/demo mode deterministic.
  const user = await db.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
  });

  if (!user || !user.passwordHash) {
    await runDummyComparison(password);
    return null;
  }

  if (!user.isActive) {
    await runDummyComparison(password);
    return null;
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  // Best-effort: record the login timestamp. A failure here must not block an
  // otherwise-valid login.
  try {
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    // ignore — non-critical bookkeeping
  }

  return {
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
    isActive: user.isActive,
    name: user.name,
    email: user.email,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Required when not running on Vercel's inferred host (§14: NEXT_PUBLIC_APP_URL).
  trustHost: true,
  secret: env.AUTH_SECRET,

  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },

  // Centralized auth entry point; middleware and Auth.js both redirect here.
  pages: {
    signIn: "/login",
    error: "/login",
  },

  // Explicit cookie hardening (§8.2): httpOnly, SameSite=Lax, Secure in prod.
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (credentials) => authorizeCredentials(credentials),
    }),
  ],

  callbacks: {
    /**
     * On initial sign-in only, copy the non-sensitive claims onto the token
     * (§7.3). On subsequent requests `user` is undefined and the token passes
     * through unchanged — no per-request DB query (the JWT performance win).
     */
    jwt: ({ token, user }) => {
      // `user` is only defined on the initial sign-in. Its `id` is typed
      // optional by the framework, but our `authorize()` always returns one.
      if (user?.id) {
        token.id = user.id;
        token.organizationId = user.organizationId;
        token.role = user.role;
        token.isActive = user.isActive ?? true;
        token.name = user.name ?? null;
        token.email = user.email ?? null;
      }
      return token;
    },

    /**
     * Project the token claims onto `session.user` so Server Components and
     * Server Actions can read `session.user.organizationId` / `.role` directly
     * (§7.4).
     */
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id;
        session.user.organizationId = token.organizationId;
        session.user.role = token.role;
        session.user.isActive = token.isActive;
      }
      return session;
    },
  },
});
