import { describe, expect, it } from "vitest";

import {
  formatMoney,
  moneyToString,
  roundMoney,
  subtractFloorZero,
  sumDecimals,
  toDecimal,
} from "@/lib/money";

/** Money primitive tests (Phase 5, §5, §40). */
describe("money helpers", () => {
  it("coerces strings, numbers, and empties to Decimal", () => {
    expect(moneyToString(toDecimal("12.5"))).toBe("12.50");
    expect(moneyToString(toDecimal(0))).toBe("0.00");
    expect(moneyToString(toDecimal(""))).toBe("0.00");
    expect(moneyToString(toDecimal(null))).toBe("0.00");
  });

  it("rounds half-up to 2dp", () => {
    expect(moneyToString(roundMoney(toDecimal("1.005")))).toBe("1.01");
    expect(moneyToString(roundMoney(toDecimal("1.004")))).toBe("1.00");
  });

  it("sums decimals without float drift", () => {
    expect(moneyToString(sumDecimals([toDecimal("0.1"), toDecimal("0.2")]))).toBe("0.30");
  });

  it("subtracts with a zero floor", () => {
    expect(moneyToString(subtractFloorZero(toDecimal("10"), toDecimal("3")))).toBe("7.00");
    expect(moneyToString(subtractFloorZero(toDecimal("3"), toDecimal("10")))).toBe("0.00");
  });

  it("formats with a currency", () => {
    expect(formatMoney("1234.5", "USD", "en-US")).toBe("$1,234.50");
  });

  it("falls back gracefully for an unknown currency code", () => {
    expect(formatMoney("10", "ZZZ")).toContain("10.00");
  });
});
