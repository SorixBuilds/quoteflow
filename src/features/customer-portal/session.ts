import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";

/**
 * Customer Portal session plane (§12.6, §12.9, §22.1).
 *
 * This is a **separate authentication plane** from the staff Auth.js session.
 * It deliberately shares nothing with `lib/auth.ts`/`features/auth` except the
 * `AUTH_SECRET` signing key (§22.1: "fewer secrets to rotate, kept
 * non-interchangeable by claim shape, not by using different keys"):
 *
 *   - A **distinctly named** cookie (`qf_portal_session`), scoped to the
 *     `/portal` path so a staff route never even receives it.
 *   - A **disjoint claim shape**: `{ customerId, organizationId }` — never a
 *     `userId`, never a `role`. `requireSession()` decodes a different shape, so
 *     a leaked portal cookie cannot be replayed against the internal app and
 *     vice-versa (§12.9).
 *   - **No import** of `requireSession`/`requireRole`/`auth` — the import
 *     boundary is a first-class, CI-tested guarantee (§12.12, §25), so this
 *     module must never reach into the staff auth surface.
 *
 * The token is an HMAC-signed JSON payload — the same constant-time-compared
 * `node:crypto` HMAC primitive the frozen Phase 5 quote share link uses
 * (`lib/tokens.ts`), not a new dependency.
 */

/** The portal session claims — intentionally disjoint from the staff `SessionUser`. */
export type PortalSession = {
  customerId: string;
  organizationId: string;
};

/** Full signed payload, including issued-at / expiry (epoch seconds). */
type PortalSessionPayload = PortalSession & { iat: number; exp: number };

/** Distinct cookie name — never collides with Auth.js's `authjs.session-token`. */
export const PORTAL_SESSION_COOKIE = "qf_portal_session";

/** Default 30-day lifetime (§12.9). Re-issued on each successful redemption. */
export const PORTAL_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/** Domain-separated HMAC purpose, so a portal signature can never be a quote-link signature. */
const PURPOSE = "portal-session:v1";

function sign(body: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(`${PURPOSE}:${body}`).digest("base64url");
}

function encodeBody(payload: PortalSessionPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/** Serialize + sign a portal session into the opaque cookie value. */
export function signPortalSession(
  session: PortalSession,
  ttlSeconds: number = PORTAL_SESSION_TTL_SECONDS,
): string {
  const now = Math.floor(Date.now() / 1000);
  const body = encodeBody({ ...session, iat: now, exp: now + ttlSeconds });
  return `${body}.${sign(body)}`;
}

/**
 * Verify a cookie value and return its claims, or `null` for anything forged,
 * tampered, malformed, or expired. Never throws — a bad cookie is simply "no
 * session," so a corrupt value degrades to the login screen, not a 500.
 */
export function verifyPortalSession(value: string | undefined): PortalSession | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(body);

  // Constant-time compare; bail before allocating if lengths differ.
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  let payload: PortalSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof payload?.customerId !== "string" ||
    typeof payload?.organizationId !== "string" ||
    typeof payload?.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return { customerId: payload.customerId, organizationId: payload.organizationId };
}

/** Read + verify the portal session from the request cookies, or `null`. */
export async function getPortalSession(): Promise<PortalSession | null> {
  const store = await cookies();
  return verifyPortalSession(store.get(PORTAL_SESSION_COOKIE)?.value);
}

/**
 * Assert a portal session at the top of a `/portal/*` page or portal action.
 * Redirects to the portal login (never `/login`) when absent — the analog of the
 * staff `requireSession()`, but for a `Customer`, returning only
 * `{ customerId, organizationId }`.
 */
export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    redirect("/portal/login");
  }
  return session;
}

/** Set the portal cookie (called from the redeem action / route handler only). */
export async function setPortalSessionCookie(session: PortalSession): Promise<void> {
  const store = await cookies();
  store.set(PORTAL_SESSION_COOKIE, signPortalSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/portal",
    maxAge: PORTAL_SESSION_TTL_SECONDS,
  });
}

/** Clear the portal cookie (logout). */
export async function clearPortalSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete({ name: PORTAL_SESSION_COOKIE, path: "/portal" });
}
