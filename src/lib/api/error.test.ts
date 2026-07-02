import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ApiError, apiHandler, errorResponse } from "@/lib/api/error";

/**
 * §21.10: one standardized envelope, one shared wrapper. A typed ApiError maps
 * to `{ error: { code, message } }` with its status (and Retry-After for 429s);
 * anything unexpected becomes an opaque 500 — no internal detail leaks.
 */

const req = new Request("https://api.test/api/v1/leads");
const ctx = { params: Promise.resolve({}) };

describe("errorResponse envelope", () => {
  it("serializes status, code, and message", async () => {
    const res = errorResponse(new ApiError(403, "insufficient_scope", "Missing scope."));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: { code: "insufficient_scope", message: "Missing scope." },
    });
  });

  it("adds a Retry-After header for rate limits (§21.11)", () => {
    const res = errorResponse(new ApiError(429, "rate_limited", "Slow down.", 42));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });
});

describe("apiHandler wrapper", () => {
  it("passes a successful response through untouched", async () => {
    const handler = apiHandler(async () => Response.json({ data: [] }));
    const res = await handler(req, ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [] });
  });

  it("maps a thrown ApiError to its envelope", async () => {
    const handler = apiHandler(async () => {
      throw new ApiError(401, "missing_api_key", "No key.");
    });
    const res = await handler(req, ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "missing_api_key", message: "No key." } });
  });

  it("maps any other error to an opaque 500 — nothing internal leaks", async () => {
    const handler = apiHandler(async () => {
      throw new Error("secret prisma detail P1234 at db.internal");
    });
    const res = await handler(req, ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal_error");
    expect(JSON.stringify(body)).not.toContain("prisma");
  });
});
