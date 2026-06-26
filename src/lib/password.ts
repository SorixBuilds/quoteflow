import bcrypt from "bcryptjs";

import { env } from "@/lib/env";

/**
 * Password hashing/comparison — the single source of truth for bcrypt usage
 * (§9.1). The work factor is externalized via `BCRYPT_COST_FACTOR` so it can be
 * raised as hardware improves without touching call sites.
 *
 * Nothing else belongs in this file (§21, rule 8): no validation, no DB access.
 */

const COST = env.BCRYPT_COST_FACTOR;

/**
 * A bcrypt hash of an arbitrary value, computed once per process with the
 * configured cost factor. Used by {@link runDummyComparison} so the
 * "user not found" / "no password set" login path spends the same time as a
 * real comparison, closing the timing side-channel described in §9.7.
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash("unused-timing-placeholder", COST);
  return dummyHashPromise;
}

/** Hash a plaintext password for storage. bcrypt embeds its own per-hash salt. */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

/** Constant-time comparison of a plaintext password against a stored hash. */
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Run a throwaway bcrypt comparison and always resolve `false`. Call this on
 * the login path when the user is absent, inactive, or has no password hash, so
 * that branch is indistinguishable in time from a genuine wrong-password
 * comparison (§9.7).
 */
export async function runDummyComparison(plain: string): Promise<false> {
  await bcrypt.compare(plain, await getDummyHash());
  return false;
}
