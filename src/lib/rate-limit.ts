/**
 * In-memory login rate limiter (§15) — built from primitives, no new dependency
 * (§22). Implements the approved policy: a small number of free attempts within
 * a window, then a *progressive delay* (not a hard lockout, which would itself
 * be a denial-of-service vector — §15 "Account lockout strategy").
 *
 * Scope/limitation (documented): state lives in this process's memory, so it
 * does not coordinate across serverless instances or survive a cold start. That
 * is an accepted Phase 3 trade-off; the upgrade path is a shared store (e.g.
 * Redis) once a deployment runs multiple instances.
 *
 * Pure and time-injectable so the threshold behavior is unit-testable (§19).
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes (§15)
const FREE_ATTEMPTS = 5; // 5 attempts / 15 minutes before delays begin (§15)
const BASE_DELAY_MS = 1000; // first imposed delay after the free attempts
const MAX_DELAY_MS = 5 * 60 * 1000; // cap the progressive backoff at 5 minutes

type Attempt = { failures: number; lastFailureAt: number };

const store = new Map<string, Attempt>();

/**
 * How long the caller must wait before another attempt for `key` is allowed.
 * Returns 0 when an attempt may proceed immediately.
 */
export function getRetryDelayMs(key: string, now: number = Date.now()): number {
  const entry = store.get(key);
  if (!entry) {
    return 0;
  }
  // Window elapsed since the last failure → forget the history.
  if (now - entry.lastFailureAt > WINDOW_MS) {
    store.delete(key);
    return 0;
  }
  if (entry.failures <= FREE_ATTEMPTS) {
    return 0;
  }
  const over = entry.failures - FREE_ATTEMPTS;
  const delay = Math.min(BASE_DELAY_MS * 2 ** (over - 1), MAX_DELAY_MS);
  const remaining = entry.lastFailureAt + delay - now;
  return remaining > 0 ? remaining : 0;
}

/** Record a failed login attempt for `key`, extending the progressive delay. */
export function recordFailedAttempt(
  key: string,
  now: number = Date.now(),
): void {
  const entry = store.get(key);
  if (!entry || now - entry.lastFailureAt > WINDOW_MS) {
    store.set(key, { failures: 1, lastFailureAt: now });
    return;
  }
  store.set(key, { failures: entry.failures + 1, lastFailureAt: now });
}

/** Clear the attempt history for `key` (call on a successful login). */
export function clearAttempts(key: string): void {
  store.delete(key);
}

/** Test helper — wipe all rate-limit state. */
export function __resetRateLimitStore(): void {
  store.clear();
}
