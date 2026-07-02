import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getAttachmentsForEntity } = vi.hoisted(() => ({
  db: {
    customer: { findFirst: vi.fn() },
    quote: { findFirst: vi.fn(), findMany: vi.fn() },
    invoice: { findFirst: vi.fn(), findMany: vi.fn() },
    job: { findFirst: vi.fn(), findMany: vi.fn() },
  },
  getAttachmentsForEntity: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/config/service", () => ({
  getCompanyConfig: vi.fn().mockResolvedValue({ locale: { currency: "USD" } }),
}));
vi.mock("@/features/files/queries", () => ({ getAttachmentsForEntity }));

import { Decimal } from "@/lib/money";
import {
  getPortalEntityFiles,
  getPortalInvoice,
  getPortalQuote,
  listPortalQuotes,
  portalOwnsDocument,
} from "@/features/customer-portal/queries";

/**
 * Portal read-path scoping (§12.8, §12.9). Every query must constrain by BOTH
 * `customerId` and `organizationId`; an id outside the session's scope resolves
 * to "not found," never another customer's data — the IDOR/tenant-isolation
 * guarantee. Drafts are never visible.
 */
const session = { customerId: "cust-1", organizationId: "org-1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listPortalQuotes (§12.8)", () => {
  it("scopes to the session customer + org and excludes drafts", async () => {
    db.quote.findMany.mockResolvedValue([]);
    await listPortalQuotes(session);

    const where = db.quote.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe("org-1");
    expect(where.customerId).toBe("cust-1");
    expect(where.status.in).not.toContain("DRAFT");
    expect(where.status.in).toContain("SENT");
  });
});

describe("getPortalQuote (IDOR)", () => {
  it("returns null when the id is not the customer's (no leak)", async () => {
    db.quote.findFirst.mockResolvedValue(null);
    const result = await getPortalQuote(session, "someone-elses-quote");
    expect(result).toBeNull();

    const where = db.quote.findFirst.mock.calls[0][0].where;
    expect(where.customerId).toBe("cust-1");
    expect(where.organizationId).toBe("org-1");
  });

  it("marks a SENT quote decidable and serializes money to strings", async () => {
    db.quote.findFirst.mockResolvedValue({
      id: "q1",
      quoteNumber: "Q-001",
      status: "SENT",
      currency: "USD",
      subtotal: new Decimal("100.00"),
      taxAmount: new Decimal("10.00"),
      total: new Decimal("110.00"),
      discountType: null,
      discountValue: null,
      issueDate: null,
      expiryDate: null,
      notes: null,
      terms: null,
      items: [
        { description: "Work", quantity: new Decimal("1"), unitPrice: new Decimal("100.00"), lineTotal: new Decimal("100.00") },
      ],
    });
    const result = await getPortalQuote(session, "q1");
    expect(result?.decidable).toBe(true);
    expect(result?.total).toBe("110.00");
    expect(result?.items[0].lineTotal).toBe("100.00");
  });
});

describe("getPortalInvoice", () => {
  it("computes a floored balance", async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: "inv1",
      invoiceNumber: "INV-001",
      status: "PARTIAL",
      amount: new Decimal("200.00"),
      paidAmount: new Decimal("50.00"),
      dueDate: null,
      issuedAt: null,
      payments: [],
    });
    const result = await getPortalInvoice(session, "inv1");
    expect(result?.balance).toBe("150.00");
  });
});

describe("portalOwnsDocument (§10.8, §12.5)", () => {
  it("confirms ownership of a visible quote", async () => {
    db.quote.findFirst.mockResolvedValue({ id: "q1" });
    expect(await portalOwnsDocument(session, "quote", "q1")).toBe(true);
  });

  it("denies an invoice the customer does not own", async () => {
    db.invoice.findFirst.mockResolvedValue(null);
    expect(await portalOwnsDocument(session, "invoice", "x")).toBe(false);
  });

  it("never exposes internal job documents to the portal", async () => {
    expect(await portalOwnsDocument(session, "job-sheet", "j1")).toBe(false);
    expect(await portalOwnsDocument(session, "work-order", "j1")).toBe(false);
    expect(db.job.findFirst).not.toHaveBeenCalled();
  });
});

describe("getPortalEntityFiles", () => {
  it("returns null (and lists nothing) when the entity is not the customer's", async () => {
    db.quote.findFirst.mockResolvedValue(null);
    const result = await getPortalEntityFiles(session, "QUOTE", "q-other");
    expect(result).toBeNull();
    expect(getAttachmentsForEntity).not.toHaveBeenCalled();
  });

  it("lists attachments once ownership is proven", async () => {
    db.quote.findFirst.mockResolvedValue({ id: "q1" });
    getAttachmentsForEntity.mockResolvedValue([{ id: "f1" }]);
    const result = await getPortalEntityFiles(session, "QUOTE", "q1");
    expect(result).toEqual([{ id: "f1" }]);
    expect(getAttachmentsForEntity).toHaveBeenCalledWith("org-1", "QUOTE", "q1");
  });
});
