import type {
  RateLimiter,
  RateLimitResult,
} from "@/lib/rate-limit/limiter";

/**
 * The zero-cost default API rate limiter (Phase 6, §21.6, §21.11).
 *
 * Implements `checkLimit()` as a fixed-capacity sliding window: at most
 * `LIMIT` requests per `WINDOW_MS` per key. Phase 6A ships exactly the
 * "small in-process" front the architecture describes (§21.11); the durable
 * counter store that lets the window survive across serverless instances is
 * added alongside the Public API and its `ApiKey` table in Step 12 — a change
 * inside this class only, behind the unchanged `RateLimiter` interface. Named
 * `DbRateLimiter` to match §21.6's roadmap name and reserve that identity for
 * the persistent tier.
 *
 * State is module-level (not per-instance) so the limit is shared across the
 * many short-lived instances the resolver constructs per request — the same
 * reason the frozen login limiter keeps its `Map` at module scope. Pure and
 * time-injectable so the threshold/reset behavior is unit-testable without
 * waiting real seconds (§21.12).
 */

const WINDOW_MS = 60_000; // 60-second sliding window (§21.11)
const LIMIT = 100; // requests per window per key — generous for Standard-tier integrations

/** Timestamps (ms) of recent requests per key. Pruned on each check. */
const buckets = new Map<string, number[]>();

export class DbRateLimiter implements RateLimiter {
  readonly name = "db";

  async checkLimit(
    key: string,
    now: number = Date.now(),
  ): Promise<RateLimitResult> {
    const windowStart = now - WINDOW_MS;
    const recent = (buckets.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= LIMIT) {
      // Oldest in-window request defines when a slot frees up.
      const oldest = recent[0];
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + WINDOW_MS - now) / 1000),
      );
      buckets.set(key, recent);
      return { allowed: false, retryAfterSeconds };
    }

    recent.push(now);
    buckets.set(key, recent);
    return { allowed: true };
  }
}

/** The window size, exported so the API layer can advertise it in headers. */
export const RATE_LIMIT = { limit: LIMIT, windowMs: WINDOW_MS } as const;

/** Test helper — wipe all rate-limit state. */
export function __resetApiRateLimitStore(): void {
  buckets.clear();
}
