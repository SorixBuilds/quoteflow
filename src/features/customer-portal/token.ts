import { generateSecretToken, hashToken, verifyToken } from "@/lib/secrets";

/**
 * Customer Portal access-token minting and verification (§7.2.7, §12).
 *
 * This is the **stored, revocable** portal token — distinct from, and coexisting
 * with, the frozen Phase 5 stateless per-Quote HMAC share link (`lib/tokens.ts`),
 * which is unchanged. A staff member issues a token for an ongoing customer
 * relationship; only its bcrypt `tokenHash` is stored (§7.2.7), so a leaked
 * database row never reveals a usable token, and an issued token can be revoked
 * (`revokedAt`) or expired (`expiresAt`) independently of any quote's status.
 *
 * Pure crypto/format surface — no DB access (that is the repository's job), so it
 * is unit-testable without a database.
 */

/** The parts of a freshly issued portal token: the one-time plaintext and what we persist. */
export type GeneratedPortalToken = {
  /** Full token embedded in the `/portal/login?token=...` link — returned once, never stored. */
  plaintext: string;
  /** bcrypt hash of the token — stored. */
  tokenHash: string;
};

/**
 * Issue a new portal token: a high-entropy random value plus its bcrypt hash.
 * The plaintext is the only chance to capture the token — the caller surfaces it
 * in the share link and then discards it.
 */
export async function generatePortalToken(): Promise<GeneratedPortalToken> {
  const plaintext = generateSecretToken(32);
  const tokenHash = await hashToken(plaintext);
  return { plaintext, tokenHash };
}

/** Constant-time verification of a presented token against its stored bcrypt hash. */
export function verifyPortalToken(plaintext: string, tokenHash: string): Promise<boolean> {
  return verifyToken(plaintext, tokenHash);
}
