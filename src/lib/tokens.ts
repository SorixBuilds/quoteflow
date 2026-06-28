import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Stateless share-link tokens (Phase 5, §16, §35 gap #2, §39).
 *
 * The customer-facing quote view needs an unguessable handle for exactly one
 * Quote, without adding a column to the frozen schema and without granting any
 * session. We derive an HMAC of the quote id with the server's `AUTH_SECRET`
 * and pack `{id}.{sig}` into the URL. Verification recomputes the HMAC and
 * compares in constant time, so the token is:
 *   - unguessable (HMAC over a server secret),
 *   - non-enumerable (knowing one token reveals nothing about another),
 *   - single-purpose (it authorizes read + accept/decline on that one quote only,
 *     enforced by the caller re-scoping every query to the decoded id),
 *   - zero-schema-change (nothing is stored).
 *
 * Server-only: reads `AUTH_SECRET`.
 */

const PURPOSE = "quote-share:v1";

function sign(id: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${PURPOSE}:${id}`)
    .digest("base64url");
}

/** Build the opaque token embedded in `/q/[token]`. */
export function createQuoteShareToken(quoteId: string): string {
  return `${quoteId}.${sign(quoteId)}`;
}

/**
 * Verify a token and return the quote id it authorizes, or `null` if the
 * signature does not match (forged, truncated, or tampered).
 */
export function verifyQuoteShareToken(token: string): string | null {
  const lastDot = token.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const id = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const expected = sign(id);

  // Constant-time compare; bail before allocating if lengths differ.
  if (sig.length !== expected.length) return null;
  const ok = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  return ok ? id : null;
}
