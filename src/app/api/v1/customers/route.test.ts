import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, service, dbMock } = vi.hoisted(() => ({
  auth: { requireApiKey: vi.fn() },
  service: { createCustomerCore: vi.fn(), updateCustomerCore: vi.fn() },
  dbMock: { customer: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn() } },
}));

vi.mock("@/lib/api/auth", () => auth);
vi.mock("@/features/customers/service", () => service);
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { POST } from "@/app/api/v1/customers/route";
import { BusinessRuleError } from "@/lib/errors";

/**
 * Representative write-handler test (§21.12): the scope demanded is the write
 * scope; the body is validated by the SHARED schema before the core runs; the
 * core receives the key's tenant + actor; rule violations and bad input map to
 * the standardized error envelope.
 */

const ctx = { params: Promise.resolve({}) };

function post(body: unknown): Request {
  return new Request("https://api.test/api/v1/customers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  auth.requireApiKey.mockResolvedValue({
    keyId: "key-1",
    organizationId: "org-1",
    scopes: ["customers:write"],
    actorId: "owner-1",
  });
  service.createCustomerCore.mockResolvedValue({ id: "c1" });
});
afterEach(() => vi.clearAllMocks());

describe("POST /api/v1/customers", () => {
  it("demands customers:write and calls the shared core with tenant + actor", async () => {
    const res = await POST(post({ name: "Acme LLC", type: "BUSINESS" }), ctx);

    expect(auth.requireApiKey).toHaveBeenCalledWith(expect.anything(), "customers:write");
    expect(service.createCustomerCore).toHaveBeenCalledWith(
      { organizationId: "org-1", actorId: "owner-1" },
      expect.objectContaining({ name: "Acme LLC", type: "BUSINESS" }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: "c1" } });
  });

  it("422s a schema violation before the core runs", async () => {
    const res = await POST(post({ name: "", type: "BUSINESS" }), ctx);
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("validation_error");
    expect(service.createCustomerCore).not.toHaveBeenCalled();
  });

  it("400s malformed JSON", async () => {
    const res = await POST(post("{not json"), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_json");
  });

  it("maps a BusinessRuleError from the core to a 422 with its message", async () => {
    service.createCustomerCore.mockRejectedValue(
      new BusinessRuleError("That customer could not be found."),
    );
    const res = await POST(post({ name: "Acme", type: "BUSINESS" }), ctx);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: {
        code: "business_rule_violation",
        message: "That customer could not be found.",
      },
    });
  });
});
