import { afterEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({ dbMock: { $queryRaw: vi.fn() } }));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { GET } from "@/app/api/health/route";

/**
 * §22/§24: the health probe reports the DB reachability truthfully (200 vs
 * 503) and never leaks internal detail — only a coarse ok/error per check.
 */

afterEach(() => vi.clearAllMocks());

describe("GET /api/health", () => {
  it("returns 200 healthy when the database responds", async () => {
    dbMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database).toBe("ok");
  });

  it("returns 503 unhealthy when the database check throws — no internal detail leaks", async () => {
    dbMock.$queryRaw.mockRejectedValue(new Error("connection refused at 10.0.0.5:5432"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database).toBe("error");
    expect(JSON.stringify(body)).not.toContain("10.0.0.5");
  });
});
