import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import { env } from "@/lib/env";

/**
 * Shared secret primitives for Phase 6 infrastructure (§7.2.3 ApiKey, §7.2.7
 * PortalAccessToken, §7.2.4 Webhook). This is the single source of truth for
 * generating high-entropy secrets and for one-way hashing the ones we
 * authenticate against — the same way `lib/password.ts` is the single source of
 * truth for password hashing. Nothing else belongs here (no DB access, no
 * validation), mirroring the `password.ts` discipline.
 *
 * Two distinct security shapes, deliberately kept separate (§21.9, §20.9):
 *   - **One-way auth tokens** (API key, portal token) — we only ever need to
 *     *verify* a presented value, never recover it, so we store a bcrypt
 *     `hash` and throw the plaintext away after showing it once. {@link hashToken}
 *     / {@link verifyToken}.
 *   - **A signing secret** (webhook HMAC secret) — the server needs the value
 *     *back* on every outbound delivery to compute the signature, so it cannot be
 *     one-way hashed; it is generated here with the same CSPRNG and stored as
 *     issued, shown once at creation. {@link generateSecretToken}.
 *
 * Bcrypt cost is shared with password hashing via `BCRYPT_COST_FACTOR` so the
 * whole app raises its work factor from one place as hardware improves.
 */

const COST = env.BCRYPT_COST_FACTOR;

/**
 * A URL-safe, high-entropy random token. 32 bytes (256 bits) by default — the
 * same strength as a session secret, far beyond brute-force reach. base64url so
 * it is safe to embed in a URL or an `Authorization` header without encoding.
 */
export function generateSecretToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** bcrypt hash of an auth token for storage. bcrypt embeds its own per-hash salt. */
export function hashToken(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/** Constant-time comparison of a presented token against its stored bcrypt hash. */
export function verifyToken(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
