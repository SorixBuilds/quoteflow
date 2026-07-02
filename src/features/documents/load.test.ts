import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    quote: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    job: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/config/service", () => ({ getCompanyConfig: vi.fn() }));

import { db } from "@/lib/db";
import { canRenderType, loadRenderModel } from "@/features/documents/load";

const owner = { organizationId: "org-1", role: "OWNER" as const, userId: "u1" };
const field = { organizationId: "org-1", role: "FIELD" as const, userId: "u1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("canRenderType (§10.8 role gate)", () => {
  it("limits Quote/Invoice/Receipt to OWNER/STAFF", () => {
    expect(canRenderType("quote", "OWNER")).toBe(true);
    expect(canRenderType("quote", "STAFF")).toBe(true);
    expect(canRenderType("quote", "FIELD")).toBe(false);
    expect(canRenderType("invoice", "FIELD")).toBe(false);
    expect(canRenderType("receipt", "FIELD")).toBe(false);
  });

  it("allows FIELD to render Job Sheets / Work Orders", () => {
    expect(canRenderType("job-sheet", "FIELD")).toBe(true);
    expect(canRenderType("work-order", "FIELD")).toBe(true);
  });
});

describe("loadRenderModel scoping (§10.9)", () => {
  it("refuses a FIELD user a Quote without ever querying the database", async () => {
    const result = await loadRenderModel("quote", "q1", field);
    expect(result).toBeNull();
    expect(db.quote.findFirst).not.toHaveBeenCalled();
  });

  it("scopes the Quote query to the caller's organization", async () => {
    vi.mocked(db.quote.findFirst).mockResolvedValue(null);
    const result = await loadRenderModel("quote", "q1", owner);
    expect(result).toBeNull(); // not found in scope → caller answers 404
    expect(db.quote.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q1", organizationId: "org-1" } }),
    );
  });

  it("adds an assignedToId filter for a FIELD user's Job Sheet", async () => {
    vi.mocked(db.job.findFirst).mockResolvedValue(null);
    await loadRenderModel("job-sheet", "j1", field);
    expect(db.job.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "j1", organizationId: "org-1", assignedToId: "u1" },
      }),
    );
  });

  it("does NOT restrict an OWNER's Job Sheet to a single assignee", async () => {
    vi.mocked(db.job.findFirst).mockResolvedValue(null);
    await loadRenderModel("job-sheet", "j1", owner);
    const callArg = vi.mocked(db.job.findFirst).mock.calls.at(-1)?.[0] as { where: object };
    expect(callArg.where).toEqual({ id: "j1", organizationId: "org-1" });
    expect(callArg.where).not.toHaveProperty("assignedToId");
  });
});
