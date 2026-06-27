import { beforeEach, describe, expect, it } from "vitest";

import {
  __resetRateLimitStore,
  clearAttempts,
  getRetryDelayMs,
  recordFailedAttempt,
} from "@/lib/rate-limit";

const KEY = "user@example.com:1.2.3.4";
const T0 = 1_000_000_000_000;

describe("login rate limiter (§15)", () => {
  beforeEach(() => {
    __resetRateLimitStore();
  });

  it("allows attempts with no prior failures", () => {
    expect(getRetryDelayMs(KEY, T0)).toBe(0);
  });

  it("allows the first 5 failures without delay (5 / 15 min)", () => {
    for (let i = 0; i < 5; i += 1) {
      recordFailedAttempt(KEY, T0);
    }
    expect(getRetryDelayMs(KEY, T0)).toBe(0);
  });

  it("imposes a progressive delay after the free attempts", () => {
    for (let i = 0; i < 6; i += 1) {
      recordFailedAttempt(KEY, T0);
    }
    const delay = getRetryDelayMs(KEY, T0);
    expect(delay).toBeGreaterThan(0);
    // delay elapses → allowed again
    expect(getRetryDelayMs(KEY, T0 + delay)).toBe(0);
  });

  it("escalates the delay as failures accumulate", () => {
    for (let i = 0; i < 6; i += 1) recordFailedAttempt(KEY, T0);
    const sixth = getRetryDelayMs(KEY, T0);
    recordFailedAttempt(KEY, T0);
    const seventh = getRetryDelayMs(KEY, T0);
    expect(seventh).toBeGreaterThan(sixth);
  });

  it("forgets history after the 15-minute window elapses", () => {
    for (let i = 0; i < 6; i += 1) recordFailedAttempt(KEY, T0);
    expect(getRetryDelayMs(KEY, T0 + 15 * 60 * 1000 + 1)).toBe(0);
  });

  it("clearAttempts resets on a successful login", () => {
    for (let i = 0; i < 6; i += 1) recordFailedAttempt(KEY, T0);
    clearAttempts(KEY);
    expect(getRetryDelayMs(KEY, T0)).toBe(0);
  });

  it("is not a hard lockout — the delay is bounded", () => {
    for (let i = 0; i < 40; i += 1) recordFailedAttempt(KEY, T0);
    // Capped at 5 minutes (§15 progressive delay, not lockout).
    expect(getRetryDelayMs(KEY, T0)).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});
