import type { Provider } from "@/lib/providers/types";

/**
 * Rate limiter contract (Phase 6, §6.1, §21.6).
 *
 * The single interface the Public API's `requireApiKey()` calls to bound request
 * volume per key. Phase 6A ships the interface, the zero-cost default
 * (`DbRateLimiter` — a sliding window), and the resolver; the API routes that
 * consume it are Steps 12–13 (§29). A funded `UpstashRateLimiter` is one new
 * file plus `RATE_LIMITER=upstash` (§21.13) — no change to any route handler.
 *
 * This is a distinct concern from the frozen Phase 3 login limiter
 * (`@/lib/rate-limit`), which throttles failed *logins* with a progressive
 * delay. This one bounds authenticated *API* request volume. Two different
 * surfaces, two different policies; the login limiter is untouched.
 */
export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying, when `allowed` is false. */
  retryAfterSeconds?: number;
}

export interface RateLimiter extends Provider {
  /** Whether a request keyed by `key` (e.g. an ApiKey id) may proceed now. */
  checkLimit(key: string): Promise<RateLimitResult>;
}
