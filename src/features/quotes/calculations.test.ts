import { describe, expect, it } from "vitest";

import { calculateQuoteTotal } from "@/features/quotes/calculations";
import { moneyToString } from "@/lib/money";

/**
 * Pricing engine tests (Phase 5, §40). The discount-before-tax order, per-line
 * proportional tax, fixed-discount floor, and rounding are all asserted here —
 * this function is the single source of truth for every quote total.
 */
describe("calculateQuoteTotal", () => {
  it("computes line totals and subtotal with no tax or discount", () => {
    const calc = calculateQuoteTotal(
      [{ quantity: "2", unitPrice: "100.00", taxRatePercent: null }],
      null,
    );
    expect(moneyToString(calc.subtotal)).toBe("200.00");
    expect(moneyToString(calc.taxAmount)).toBe("0.00");
    expect(moneyToString(calc.total)).toBe("200.00");
  });

  it("applies per-line tax", () => {
    const calc = calculateQuoteTotal(
      [{ quantity: "1", unitPrice: "100.00", taxRatePercent: "10" }],
      null,
    );
    expect(moneyToString(calc.taxAmount)).toBe("10.00");
    expect(moneyToString(calc.total)).toBe("110.00");
  });

  it("applies a percent discount BEFORE tax (§17 order)", () => {
    const calc = calculateQuoteTotal(
      [{ quantity: "1", unitPrice: "100.00", taxRatePercent: "10" }],
      { type: "PERCENT", value: "10" },
    );
    // subtotal 100 → discounted 90 → tax 9 → total 99
    expect(moneyToString(calc.subtotal)).toBe("100.00");
    expect(moneyToString(calc.discountedSubtotal)).toBe("90.00");
    expect(moneyToString(calc.taxAmount)).toBe("9.00");
    expect(moneyToString(calc.total)).toBe("99.00");
  });

  it("floors a fixed discount larger than the subtotal at zero", () => {
    const calc = calculateQuoteTotal(
      [{ quantity: "1", unitPrice: "50.00", taxRatePercent: "10" }],
      { type: "FIXED", value: "80.00" },
    );
    expect(moneyToString(calc.discountedSubtotal)).toBe("0.00");
    expect(moneyToString(calc.taxAmount)).toBe("0.00");
    expect(moneyToString(calc.total)).toBe("0.00");
  });

  it("distributes tax proportionally across lines with different rates", () => {
    const calc = calculateQuoteTotal(
      [
        { quantity: "1", unitPrice: "100.00", taxRatePercent: "10" },
        { quantity: "1", unitPrice: "100.00", taxRatePercent: "20" },
      ],
      null,
    );
    // No discount: line1 tax 10, line2 tax 20 → 30
    expect(moneyToString(calc.subtotal)).toBe("200.00");
    expect(moneyToString(calc.taxAmount)).toBe("30.00");
    expect(moneyToString(calc.total)).toBe("230.00");
  });

  it("scales each line's taxable base by the discount proportionally", () => {
    const calc = calculateQuoteTotal(
      [
        { quantity: "1", unitPrice: "100.00", taxRatePercent: "10" },
        { quantity: "1", unitPrice: "100.00", taxRatePercent: "20" },
      ],
      { type: "PERCENT", value: "50" },
    );
    // discounted subtotal 100; each line's share 50 → tax 5 + 10 = 15; total 115
    expect(moneyToString(calc.discountedSubtotal)).toBe("100.00");
    expect(moneyToString(calc.taxAmount)).toBe("15.00");
    expect(moneyToString(calc.total)).toBe("115.00");
  });

  it("rounds to 2 decimal places", () => {
    const calc = calculateQuoteTotal(
      [{ quantity: "3", unitPrice: "10.333", taxRatePercent: null }],
      null,
    );
    // 3 * 10.333 = 30.999 → 31.00
    expect(moneyToString(calc.lineTotals[0])).toBe("31.00");
  });

  it("handles an empty / zero-subtotal quote without dividing by zero", () => {
    const calc = calculateQuoteTotal(
      [{ quantity: "0", unitPrice: "0", taxRatePercent: "10" }],
      null,
    );
    expect(moneyToString(calc.subtotal)).toBe("0.00");
    expect(moneyToString(calc.taxAmount)).toBe("0.00");
    expect(moneyToString(calc.total)).toBe("0.00");
  });
});
