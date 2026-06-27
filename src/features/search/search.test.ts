import { beforeEach, describe, expect, it, vi } from "vitest";

import { matchTier, normalizePhone, rankResults } from "@/features/search/ranking";
import { globalSearch } from "@/features/search/actions";
import { db } from "@/lib/db";
import { requireCompanyScope } from "@/lib/permissions";

vi.mock("@/lib/db", () => ({
  db: { lead: { findMany: vi.fn() }, customer: { findMany: vi.fn() } },
}));
vi.mock("@/lib/permissions", () => ({ requireCompanyScope: vi.fn() }));

describe("ranking primitives (Step 15)", () => {
  it("normalizes phones to digits", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
  });

  it("classifies exact / prefix / contains tiers", () => {
    expect(matchTier("ali", { name: "Ali" })).toBe(1);
    expect(matchTier("ali", { name: "Alina" })).toBe(2);
    expect(matchTier("ali", { name: "Muhammad Ali" })).toBe(3);
    expect(matchTier("zzz", { name: "Ali" })).toBeNull();
  });

  it("matches normalized phone across formatting", () => {
    expect(matchTier("5551234567", { phone: "(555) 123-4567" })).toBe(1);
  });
});

describe("rankResults ordering (Step 15)", () => {
  it("orders exact > prefix > contains regardless of input order", () => {
    const rows = [
      { id: "contains", name: "Muhammad Ali" },
      { id: "exact", name: "Ali" },
      { id: "prefix", name: "Alina" },
    ];
    const ranked = rankResults(rows, "ali", (r) => ({ name: r.name }), 10);
    expect(ranked.map((r) => r.id)).toEqual(["exact", "prefix", "contains"]);
  });
});

describe("globalSearch (Step 15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireCompanyScope).mockResolvedValue({ organizationId: "org-1" });
  });

  it("returns empty for short queries without querying", async () => {
    const result = await globalSearch("a");
    expect(result).toEqual({ leads: [], customers: [] });
    expect(db.lead.findMany).not.toHaveBeenCalled();
  });

  it("scopes both queries to the caller's organization and ranks results", async () => {
    vi.mocked(db.lead.findMany).mockResolvedValue([
      { id: "l-contains", name: "Muhammad Ali", email: null, phone: "111" },
      { id: "l-exact", name: "Ali", email: null, phone: "222" },
    ] as never);
    vi.mocked(db.customer.findMany).mockResolvedValue([] as never);

    const result = await globalSearch("ali");

    expect(db.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: "org-1" }),
      }),
    );
    expect(result.leads.map((l) => l.id)).toEqual(["l-exact", "l-contains"]);
    expect(result.leads[0]).toMatchObject({ type: "lead", href: "/leads/l-exact" });
  });
});
