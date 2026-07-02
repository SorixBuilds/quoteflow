import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DbRateLimiter,
  RATE_LIMIT,
  __resetApiRateLimitStore,
} from "@/lib/rate-limit/db-rate-limiter";
import { resolveRateLimiter } from "@/lib/rate-limit/resolve";
import { providerRegistry } from "@/lib/providers/registry";
import type { RateLimiter } from "@/lib/rate-limit/limiter";

const limiter = new DbRateLimiter();
const KEY = "apikey-1";
const T0 = 1_700_000_000_000;

beforeEach(() => {
  __resetApiRateLimitStore();
});

afterEach(() => {
  providerRegistry.reset();
});

describe("DbRateLimiter (§21.11 sliding window)", () => {
  it('identifies as "db"', () => {
    expect(limiter.name).toBe("db");
  });

  it("allows requests up to the limit within the window", async () => {
    for (let i = 0; i < RATE_LIMIT.limit; i += 1) {
      const r = await limiter.checkLimit(KEY, T0);
      expect(r.allowed).toBe(true);
    }
  });

  it("denies the request that exceeds the limit, with a retry hint", async () => {
    for (let i = 0; i < RATE_LIMIT.limit; i += 1) {
      await limiter.checkLimit(KEY, T0);
    }
    const denied = await limiter.checkLimit(KEY, T0);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", async () => {
    for (let i = 0; i < RATE_LIMIT.limit; i += 1) {
      await limiter.checkLimit(KEY, T0);
    }
    expect((await limiter.checkLimit(KEY, T0)).allowed).toBe(false);
    const after = T0 + RATE_LIMIT.windowMs + 1;
    expect((await limiter.checkLimit(KEY, after)).allowed).toBe(true);
  });

  it("isolates counts per key", async () => {
    for (let i = 0; i < RATE_LIMIT.limit; i += 1) {
      await limiter.checkLimit(KEY, T0);
    }
    expect((await limiter.checkLimit(KEY, T0)).allowed).toBe(false);
    expect((await limiter.checkLimit("apikey-2", T0)).allowed).toBe(true);
  });

  it("slides: a request frees up once its window position expires", async () => {
    // Fill the window spread across its first millisecond.
    for (let i = 0; i < RATE_LIMIT.limit; i += 1) {
      await limiter.checkLimit(KEY, T0);
    }
    expect((await limiter.checkLimit(KEY, T0)).allowed).toBe(false);
    // Just past when the first batch leaves the window, a slot is available.
    const justAfter = T0 + RATE_LIMIT.windowMs + 1;
    expect((await limiter.checkLimit(KEY, justAfter)).allowed).toBe(true);
  });
});

describe("resolveRateLimiter (§6.1 resolver)", () => {
  it("returns the db default", () => {
    expect(resolveRateLimiter().name).toBe("db");
  });

  it("honors a DI override", () => {
    const fake: RateLimiter = {
      name: "upstash",
      checkLimit: async () => ({ allowed: true }),
    };
    providerRegistry.override<RateLimiter>("rate-limiter", () => fake);
    expect(resolveRateLimiter()).toBe(fake);
  });
});
