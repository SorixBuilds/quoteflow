import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth, dbMock } = vi.hoisted(() => ({
  auth: { requireApiKey: vi.fn() },
  dbMock: { lead: { findMany: vi.fn(), count: vi.fn() } },
}));

vi.mock("@/lib/api/auth", () => auth);
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { GET } from "@/app/api/v1/leads/route";
import { ApiError } from "@/lib/api/error";

/**
 * Representative handler test (§21.12) — every /api/v1/* list handler follows
 * this identical shape, so one pins the contract: the scope demanded, the
 * organizationId constraint on BOTH the page query and the count, the
 * standardized list envelope, and the error envelope produced when
 * requireApiKey rejects.
 */

const ctx = { params: Promise.resolve({}) };
const listUrl = (query = "") => new Request(`https://api.test/api/v1/leads${query}`);

function leadRow(id: string) {
  return {
    id,
    organizationId: "org-1",
    name: "Ada",
    email: null,
    phone: "555-0100",
    status: "NEW",
    lostReason: null,
    sourceId: null,
    assignedToId: null,
    customerId: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
  };
}

beforeEach(() => {
  auth.requireApiKey.mockResolvedValue({
    keyId: "key-1",
    organizationId: "org-1",
    scopes: ["leads:read"],
  });
  dbMock.lead.findMany.mockResolvedValue([leadRow("l1")]);
  dbMock.lead.count.mockResolvedValue(1);
});
afterEach(() => vi.clearAllMocks());

describe("GET /api/v1/leads", () => {
  it("demands leads:read and scopes both queries to the key's organization", async () => {
    const res = await GET(listUrl("?status=NEW"), ctx);

    expect(auth.requireApiKey).toHaveBeenCalledWith(expect.anything(), "leads:read");
    const where = { organizationId: "org-1", status: "NEW" };
    expect(dbMock.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 0, take: 25 }),
    );
    expect(dbMock.lead.count).toHaveBeenCalledWith({ where });
    expect(res.status).toBe(200);
  });

  it("returns the §21.6 envelope with serialized rows", async () => {
    const body = await (await GET(listUrl(), ctx)).json();
    expect(body).toEqual({
      data: [
        expect.objectContaining({
          id: "l1",
          name: "Ada",
          status: "NEW",
          createdAt: "2026-06-01T00:00:00.000Z",
        }),
      ],
      pagination: { page: 1, pageSize: 25, total: 1 },
    });
    // The tenant column never crosses the wire.
    expect(body.data[0].organizationId).toBeUndefined();
  });

  it("maps an auth rejection to the §21.10 error envelope", async () => {
    auth.requireApiKey.mockRejectedValue(new ApiError(401, "invalid_api_key", "Nope."));
    const res = await GET(listUrl(), ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "invalid_api_key", message: "Nope." },
    });
    expect(dbMock.lead.findMany).not.toHaveBeenCalled();
  });

  it("422s an unknown status filter without touching the database", async () => {
    const res = await GET(listUrl("?status=BOGUS"), ctx);
    expect(res.status).toBe(422);
    expect(dbMock.lead.findMany).not.toHaveBeenCalled();
  });
});
