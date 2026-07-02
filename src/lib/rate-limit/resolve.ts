import { env } from "@/lib/env";
import { providerRegistry } from "@/lib/providers/registry";
import { PROVIDER_KEYS, ProviderNotConfiguredError } from "@/lib/providers/types";
import { DbRateLimiter } from "@/lib/rate-limit/db-rate-limiter";
import type { RateLimiter } from "@/lib/rate-limit/limiter";

/**
 * Rate limiter resolver (Phase 6, §6.1, §21.6).
 *
 * The sole branch point for which limiter is active. Reads `RATE_LIMITER`
 * (default "db"). The funded "upstash" adapter is deferred to its §21.13 funding
 * trigger; selecting it before it exists raises a clear
 * `ProviderNotConfiguredError`.
 */
function defaultRateLimiter(): RateLimiter {
  switch (env.RATE_LIMITER) {
    case "db":
      return new DbRateLimiter();
    case "upstash":
      throw new ProviderNotConfiguredError(
        PROVIDER_KEYS.rateLimiter,
        "UpstashRateLimiter is adopted at the §21.13 funding trigger. Set RATE_LIMITER=db until then.",
      );
  }
}

export function resolveRateLimiter(): RateLimiter {
  return providerRegistry.resolve(PROVIDER_KEYS.rateLimiter, defaultRateLimiter);
}
