import { describe, expect, it } from "vitest";

import { invoiceBalanceFromStrings, isInvoiceOverdue } from "@/features/invoices/calculations";
import { moneyToString } from "@/lib/money";

/** Invoice money helper tests (Phase 5, §21, §40). */
describe("invoiceBalance", () => {
  it("computes amount minus paid", () => {
    expect(moneyToString(invoiceBalanceFromStrings("100.00", "40.00"))).toBe("60.00");
  });
  it("floors at zero when overpaid", () => {
    expect(moneyToString(invoiceBalanceFromStrings("100.00", "120.00"))).toBe("0.00");
  });
});

describe("isInvoiceOverdue", () => {
  const past = new Date("2020-01-01");
  const future = new Date("2999-01-01");

  it("is overdue when unpaid and past due", () => {
    expect(isInvoiceOverdue("UNPAID", past)).toBe(true);
    expect(isInvoiceOverdue("PARTIAL", past)).toBe(true);
  });
  it("is never overdue when paid", () => {
    expect(isInvoiceOverdue("PAID", past)).toBe(false);
  });
  it("is not overdue without a due date or before it", () => {
    expect(isInvoiceOverdue("UNPAID", null)).toBe(false);
    expect(isInvoiceOverdue("UNPAID", future)).toBe(false);
  });
});
