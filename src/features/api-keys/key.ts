import { generateSecretToken, hashToken, verifyToken } from "@/lib/secrets";

/**
 * Public-API key minting and verification (§21.6, §21.8, §21.9).
 *
 * The full key is shown to the Owner exactly once at creation and never stored;
 * only its bcrypt hash (`hashedKey`) and an indexable `keyPrefix` are persisted
 * (§7.2.3). Authentication narrows by `keyPrefix` first — an indexed lookup —
 * then bcrypt-compares against the small candidate set, so verification stays
 * fast without ever keeping the full key in a searchable, un-hashed form.
 *
 * No DB access lives here (that is the repository's job); this module is the
 * pure crypto/format surface so it is unit-testable without a database.
 */

/** Live-key namespace. A future `qf_test_` namespace can be added without change. */
export const API_KEY_LIVE_PREFIX = "qf_live_";

/**
 * Number of leading characters stored as `keyPrefix` and used to narrow the
 * bcrypt-compare set at authentication time. Pinned to 11 to match the
 * authoritative lookup in §21.6 (`keyPrefix: raw.slice(0, 11)`): the 8-char
 * `qf_live_` namespace plus 3 token characters.
 */
export const KEY_PREFIX_LENGTH = 11;

/**
 * The fixed, closed set of API scopes (§21.8). An `ApiKey` is granted an
 * explicit subset — never "all scopes" by default — so a third-party integration
 * gets exactly the access it was granted (principle of least privilege).
 */
export const API_SCOPES = [
  "leads:read",
  "leads:write",
  "quotes:read",
  "quotes:write",
  "jobs:read",
  "jobs:write",
  "invoices:read",
  "invoices:write",
  "customers:read",
  "customers:write",
  "webhooks:manage",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

/** Type guard: is an arbitrary string one of the fixed, known scopes? */
export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

/** The parts of a freshly minted key: the one-time plaintext and what we persist. */
export type GeneratedApiKey = {
  /** Full key — returned to the caller once, never stored. */
  plaintext: string;
  /** Indexed narrowing prefix (`KEY_PREFIX_LENGTH` chars) — stored. */
  keyPrefix: string;
  /** bcrypt hash of the full key — stored. */
  hashedKey: string;
};

/**
 * Mint a new API key: a namespaced, high-entropy token plus the two derived
 * values the row stores. The plaintext is the only chance to capture the key —
 * the caller must surface it to the user immediately and then discard it.
 */
export async function generateApiKey(): Promise<GeneratedApiKey> {
  const plaintext = `${API_KEY_LIVE_PREFIX}${generateSecretToken(24)}`;
  const keyPrefix = plaintext.slice(0, KEY_PREFIX_LENGTH);
  const hashedKey = await hashToken(plaintext);
  return { plaintext, keyPrefix, hashedKey };
}

/** The `keyPrefix` an incoming raw key would have — for the indexed narrowing query. */
export function prefixOf(rawKey: string): string {
  return rawKey.slice(0, KEY_PREFIX_LENGTH);
}

/** Constant-time verification of a presented raw key against a stored hash. */
export function verifyApiKey(rawKey: string, hashedKey: string): Promise<boolean> {
  return verifyToken(rawKey, hashedKey);
}
