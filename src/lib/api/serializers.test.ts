import { describe, expect, it } from "vitest";
import type { Invoice, Quote } from "@prisma/client";

import { Decimal } from "@/lib/money";
import { serializeInvoice, serializeQuote } from "@/lib/api/serializers";

/**
 * Wire-format rules (§21.6, §5): money is a fixed-2 decimal string (never a JS
 * float), dates are ISO-8601 or null, and only whitelisted fields appear — the
 * serializer defines the v1 contract, so this test pins it.
 */

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q1",
    organizationId: "org-1",
    quoteNumber: "Q-0001",
    leadId: null,
    customerId: "c1",
    status: "SENT",
    version: 1,
    parentQuoteId: null,
    discountType: null,
    discountValue: null,
    subtotal: new Decimal("100.5"),
    taxAmount: new Decimal("10.05"),
    total: new Decimal("110.55"),
    currency: "USD",
    issueDate: new Date("2026-07-01T00:00:00Z"),
    expiryDate: null,
    sentAt: null,
    viewedAt: null,
    acceptedAt: null,
    declinedAt: null,
    createdById: "u1",
    assignedToId: "u1",
    notes: null,
    terms: null,
    createdAt: new Date("2026-06-01T12:00:00Z"),
    updatedAt: new Date("2026-06-02T12:00:00Z"),
    ...overrides,
  } as Quote;
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "i1",
    organizationId: "org-1",
    jobId: "j1",
    customerId: "c1",
    invoiceNumber: "INV-0001",
    amount: new Decimal("500"),
    paidAmount: new Decimal("200"),
    status: "PARTIAL",
    dueDate: null,
    issuedAt: null,
    createdAt: new Date("2026-06-01T12:00:00Z"),
    updatedAt: new Date("2026-06-01T12:00:00Z"),
    ...overrides,
  } as Invoice;
}

describe("serializeQuote", () => {
  it("emits money as fixed-2 strings and dates as ISO/null", () => {
    const wire = serializeQuote(quote());
    expect(wire.subtotal).toBe("100.50");
    expect(wire.taxAmount).toBe("10.05");
    expect(wire.total).toBe("110.55");
    expect(wire.issueDate).toBe("2026-07-01T00:00:00.000Z");
    expect(wire.expiryDate).toBeNull();
    expect(wire.createdAt).toBe("2026-06-01T12:00:00.000Z");
  });

  it("whitelists fields — tenant and server-only columns never leak", () => {
    const wire = serializeQuote(quote()) as Record<string, unknown>;
    expect(wire.organizationId).toBeUndefined();
    expect(wire.createdById).toBeUndefined();
  });
});

describe("serializeInvoice", () => {
  it("derives balance = amount − paidAmount, floored at zero", () => {
    expect(serializeInvoice(invoice()).balance).toBe("300.00");
    expect(
      serializeInvoice(
        invoice({ amount: new Decimal("100"), paidAmount: new Decimal("150") }),
      ).balance,
    ).toBe("0.00");
  });
});
