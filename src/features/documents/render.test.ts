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
import { getCompanyConfig } from "@/lib/config/service";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";
import { buildFilename, renderDocument } from "@/features/documents/render";

const owner = { id: "u1", organizationId: "org-1", role: "OWNER" as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCompanyConfig).mockResolvedValue(DEFAULT_COMPANY_CONFIG);
  vi.mocked(db.organization.findUnique).mockResolvedValue({
    name: "Acme Plumbing",
    logoUrl: null,
  } as never);
});

describe("buildFilename", () => {
  it("derives a safe, descriptive name", () => {
    expect(buildFilename("invoice", "INV-001")).toBe("invoice-INV-001.pdf");
    expect(buildFilename("quote", "QUO/2026 001")).toBe("quote-QUO-2026-001.pdf");
    expect(buildFilename("receipt", "@@@")).toBe("receipt-document.pdf");
  });
});

describe("renderDocument (§10.6 end-to-end)", () => {
  it("renders a real PDF for an in-scope Quote", async () => {
    vi.mocked(db.quote.findFirst).mockResolvedValue({
      quoteNumber: "QUO-001",
      status: "SENT",
      version: 1,
      issueDate: new Date("2026-06-28T00:00:00Z"),
      expiryDate: null,
      subtotal: 100,
      taxAmount: 10,
      total: 110,
      discountType: null,
      discountValue: null,
      notes: "Thanks",
      terms: "Net 30",
      customer: { name: "Jordan Rivera", email: "j@example.com", phone: null, address: null },
      items: [
        { description: "Service", quantity: 1, unitPrice: 100, lineTotal: 100, taxRate: null },
      ],
    } as never);

    const result = await renderDocument("quote", "q1", owner);
    expect(result).not.toBeNull();
    expect(result!.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(result!.filename).toBe("quote-QUO-001.pdf");
  }, 20_000);

  it("returns null (→ 404) when the entity is not in scope", async () => {
    vi.mocked(db.quote.findFirst).mockResolvedValue(null);
    expect(await renderDocument("quote", "missing", owner)).toBeNull();
  });

  it("returns null when a FIELD user requests a Quote (role gate)", async () => {
    const result = await renderDocument("quote", "q1", {
      id: "u1",
      organizationId: "org-1",
      role: "FIELD",
    });
    expect(result).toBeNull();
    expect(db.quote.findFirst).not.toHaveBeenCalled();
  });
});
