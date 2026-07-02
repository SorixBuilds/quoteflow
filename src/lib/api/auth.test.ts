import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { repo, keyModule, limiter } = vi.hoisted(() => ({
  repo: {
    findActiveKeyCandidatesByPrefix: vi.fn(),
    touchApiKeyLastUsed: vi.fn(),
  },
  keyModule: { verifyApiKey: vi.fn() },
  limiter: { checkLimit: vi.fn() },
}));

vi.mock("@/features/api-keys/repository", () => repo);
vi.mock("@/features/api-keys/key", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/api-keys/key")>()),
  verifyApiKey: keyModule.verifyApiKey,
}));
vi.mock("@/lib/rate-limit/resolve", () => ({ resolveRateLimiter: () => limiter }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { requireApiKey } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";

/**
 * §21.12 authentication tests: missing key, invalid key, revoked key, and
 * insufficient scope are each a distinct, correct failure; the 429 threshold
 * surfaces the limiter's verdict; success returns the key's tenant + scopes and
 * records usage.
 */

const KEY = "qf_live_abc123def456";

function request(auth?: string): Request {
  return new Request("https://api.test/api/v1/quotes", {
    headers: auth ? { authorization: auth } : {},
  });
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    organizationId: "org-1",
    hashedKey: "$2a$10$hash",
    scopes: ["quotes:read"],
    ...overrides,
  };
}

async function expectApiError(
  promise: Promise<unknown>,
  status: number,
  code: string,
): Promise<ApiError> {
  try {
    await promise;
    expect.unreachable("should have thrown");
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(status);
    expect(apiError.code).toBe(code);
    return apiError;
  }
  throw new Error("unreachable");
}

beforeEach(() => {
  limiter.checkLimit.mockResolvedValue({ allowed: true });
  repo.touchApiKeyLastUsed.mockResolvedValue({});
});
afterEach(() => vi.clearAllMocks());

describe("requireApiKey — failures (§21.12)", () => {
  it("401s with missing_api_key when there is no bearer header", async () => {
    await expectApiError(requireApiKey(request(), "quotes:read"), 401, "missing_api_key");
    await expectApiError(
      requireApiKey(request("Basic abc"), "quotes:read"),
      401,
      "missing_api_key",
    );
  });

  it("401s identically for an unknown and a revoked key (no enumeration, §22.5)", async () => {
    // Unknown: no candidates share the prefix. Revoked: the narrowing query
    // itself excludes revoked rows — same empty result, same generic 401.
    repo.findActiveKeyCandidatesByPrefix.mockResolvedValue([]);
    await expectApiError(requireApiKey(request(`Bearer ${KEY}`), "quotes:read"), 401, "invalid_api_key");
  });

  it("401s when no candidate's hash matches", async () => {
    repo.findActiveKeyCandidatesByPrefix.mockResolvedValue([candidate()]);
    keyModule.verifyApiKey.mockResolvedValue(false);
    await expectApiError(requireApiKey(request(`Bearer ${KEY}`), "quotes:read"), 401, "invalid_api_key");
  });

  it("403s when the key lacks the required scope (§21.8)", async () => {
    repo.findActiveKeyCandidatesByPrefix.mockResolvedValue([candidate({ scopes: ["leads:read"] })]);
    keyModule.verifyApiKey.mockResolvedValue(true);
    await expectApiError(
      requireApiKey(request(`Bearer ${KEY}`), "quotes:read"),
      403,
      "insufficient_scope",
    );
  });

  it("429s with the limiter's retry delay when rate-limited (§21.11)", async () => {
    repo.findActiveKeyCandidatesByPrefix.mockResolvedValue([candidate()]);
    keyModule.verifyApiKey.mockResolvedValue(true);
    limiter.checkLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 17 });

    const error = await expectApiError(
      requireApiKey(request(`Bearer ${KEY}`), "quotes:read"),
      429,
      "rate_limited",
    );
    expect(error.retryAfterSeconds).toBe(17);
    // Rate-limited requests never count as key usage.
    expect(repo.touchApiKeyLastUsed).not.toHaveBeenCalled();
  });
});

describe("requireApiKey — success (§21.6)", () => {
  it("returns the key's tenant and scopes, and records usage", async () => {
    repo.findActiveKeyCandidatesByPrefix.mockResolvedValue([
      candidate({ scopes: ["quotes:read", "leads:read"] }),
    ]);
    keyModule.verifyApiKey.mockResolvedValue(true);

    const ctx = await requireApiKey(request(`Bearer ${KEY}`), "quotes:read");

    expect(ctx).toEqual({
      keyId: "key-1",
      organizationId: "org-1",
      scopes: ["quotes:read", "leads:read"],
    });
    expect(limiter.checkLimit).toHaveBeenCalledWith("key-1");
    expect(repo.touchApiKeyLastUsed).toHaveBeenCalledWith("key-1");
  });

  it("bcrypt-compares each prefix candidate until one matches", async () => {
    repo.findActiveKeyCandidatesByPrefix.mockResolvedValue([
      candidate({ id: "other", hashedKey: "$2a$10$other", scopes: [] }),
      candidate(),
    ]);
    keyModule.verifyApiKey.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const ctx = await requireApiKey(request(`Bearer ${KEY}`), "quotes:read");
    expect(ctx.keyId).toBe("key-1");
    expect(keyModule.verifyApiKey).toHaveBeenCalledTimes(2);
  });
});
