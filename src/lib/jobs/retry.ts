import type { RetryPolicy } from "@/lib/jobs/types";

/**
 * Retry strategy (Phase 6, §11.10, §21.7).
 *
 * Exponential backoff with a hard cap — the single, shared policy email-delivery
 * retry and webhook-delivery retry both reference, so the two surfaces don't
 * each hand-roll their own backoff math. Pure functions, fully unit-testable
 * without waiting real time.
 */

/** The default applied to any `JobDefinition` that doesn't specify its own. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 5 * 60_000, // cap at 5 minutes — same ceiling as the login limiter
};

/**
 * Backoff before a given attempt. `attempt` is 1-based: attempt 1 is the initial
 * run (no delay); attempt 2 is the first retry (`baseDelayMs`); each subsequent
 * retry doubles, capped at `maxDelayMs`.
 */
export function computeBackoffMs(attempt: number, policy: RetryPolicy): number {
  if (attempt <= 1) return 0;
  const exponent = attempt - 2; // attempt 2 → 2^0 → baseDelayMs
  const delay = policy.baseDelayMs * 2 ** exponent;
  return Math.min(delay, policy.maxDelayMs);
}

/** Whether another attempt is permitted after `attempt` attempts have been made. */
export function shouldRetry(attempt: number, policy: RetryPolicy): boolean {
  return attempt < policy.maxAttempts;
}
