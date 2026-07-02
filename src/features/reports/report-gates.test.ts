import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { perms, dbMock } = vi.hoisted(() => ({
  perms: { requireRole: vi.fn(), requireCompanyScope: vi.fn() },
  dbMock: {
    invoice: { findMany: vi.fn(), groupBy: vi.fn() },
    leadSource: { findMany: vi.fn() },
    quoteItem: { findMany: vi.fn() },
    quote: { findMany: vi.fn() },
    customer: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/permissions", () => perms);
vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  getAgingReport,
  getProfitabilityReport,
  getQuoteAcceptanceTrend,
  getTaxSummary,
} from "@/features/reports/queries";

/**
 * §18.8/§18.9 role gates: the three financial reports (aging, profitability,
 * tax) are OWNER-only IN THE QUERY — a STAFF caller is rejected by
 * `requireRole` before any data is read. The operational additions
 * (acceptance trend) permit OWNER/STAFF. The gate is enforced by the query, not
 * merely the page hiding the tab.
 */

class RoleError extends Error {}

beforeEach(() => {
  perms.requireCompanyScope.mockResolvedValue({ organizationId: "org-1" });
  perms.requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1", role: "OWNER" });
  dbMock.invoice.findMany.mockResolvedValue([]);
  dbMock.invoice.groupBy.mockResolvedValue([]);
  dbMock.leadSource.findMany.mockResolvedValue([]);
  dbMock.quoteItem.findMany.mockResolvedValue([]);
  dbMock.quote.findMany.mockResolvedValue([]);
  dbMock.customer.findMany.mockResolvedValue([]);
});
afterEach(() => vi.clearAllMocks());

describe("financial reports are OWNER-only (§18.8)", () => {
  it.each([
    ["aging", () => getAgingReport()],
    ["profitability", () => getProfitabilityReport()],
    ["tax summary", () => getTaxSummary()],
  ])("%s demands the OWNER role", async (_label, run) => {
    await run();
    expect(perms.requireRole).toHaveBeenCalledWith(["OWNER"]);
  });

  it("propagates the rejection when a STAFF caller hits a financial report", async () => {
    perms.requireRole.mockRejectedValueOnce(new RoleError("forbidden"));
    await expect(getAgingReport()).rejects.toBeInstanceOf(RoleError);
    // Rejected before any invoice read.
    expect(dbMock.invoice.findMany).not.toHaveBeenCalled();
  });
});

describe("operational additions allow OWNER/STAFF (§18.8)", () => {
  it("acceptance trend permits STAFF", async () => {
    await getQuoteAcceptanceTrend();
    expect(perms.requireRole).toHaveBeenCalledWith(["OWNER", "STAFF"]);
  });
});
