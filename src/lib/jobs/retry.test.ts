import { describe, expect, it } from "vitest";

import {
  DEFAULT_RETRY_POLICY,
  computeBackoffMs,
  shouldRetry,
} from "@/lib/jobs/retry";
import type { RetryPolicy } from "@/lib/jobs/types";

const POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 10_000,
};

describe("retry strategy (§11.10/§21.7)", () => {
  it("no delay before the initial attempt", () => {
    expect(computeBackoffMs(1, POLICY)).toBe(0);
  });

  it("first retry waits baseDelayMs", () => {
    expect(computeBackoffMs(2, POLICY)).toBe(1_000);
  });

  it("doubles each subsequent retry", () => {
    expect(computeBackoffMs(3, POLICY)).toBe(2_000);
    expect(computeBackoffMs(4, POLICY)).toBe(4_000);
    expect(computeBackoffMs(5, POLICY)).toBe(8_000);
  });

  it("caps at maxDelayMs", () => {
    expect(computeBackoffMs(6, POLICY)).toBe(10_000); // 16_000 capped
    expect(computeBackoffMs(20, POLICY)).toBe(10_000);
  });

  it("shouldRetry is true until maxAttempts is reached", () => {
    expect(shouldRetry(1, POLICY)).toBe(true);
    expect(shouldRetry(4, POLICY)).toBe(true);
    expect(shouldRetry(5, POLICY)).toBe(false);
    expect(shouldRetry(6, POLICY)).toBe(false);
  });

  it("default policy is sane (>=1 attempt, capped backoff)", () => {
    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBeGreaterThanOrEqual(1);
    expect(
      computeBackoffMs(99, DEFAULT_RETRY_POLICY),
    ).toBe(DEFAULT_RETRY_POLICY.maxDelayMs);
  });
});
