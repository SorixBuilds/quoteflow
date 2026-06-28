import type { DiscountType } from "@prisma/client";

import { Decimal, roundMoney, subtractFloorZero, sumDecimals, toDecimal } from "@/lib/money";

/**
 * Quote pricing engine (Phase 5, §17). The SINGLE place a quote total is ever
 * computed — the Quote Builder calls it client-side for a live preview, and
 * `createQuote`/`updateQuote` call it server-side to write the authoritative
 * values. The client-submitted total is never trusted (§5, §39).
 *
 * Calculation order (§17), all in `Decimal`:
 *   1. lineTotal = quantity × unitPrice            (rounded to 2dp)
 *   2. subtotal  = Σ lineTotal
 *   3. discountedSubtotal:
 *        PERCENT → subtotal × (1 − value/100)
 *        FIXED   → max(subtotal − value, 0)        (rounded to 2dp)
 *   4. per line, tax = its proportional share of discountedSubtotal × its rate;
 *      summed into taxAmount                        (each line rounded to 2dp)
 *   5. total = discountedSubtotal + taxAmount
 *
 * Pure and isomorphic — no Prisma client, no auth — directly unit-tested (§40).
 * Inputs are decimal *strings* (the validated form shape) so a JS float never
 * enters the pipeline.
 */

export type CalcLine = {
  quantity: string;
  unitPrice: string;
  /** Resolved tax rate percent for this line ("8.25"), or null for no tax. */
  taxRatePercent: string | null;
};

export type CalcDiscount = { type: DiscountType; value: string } | null;

export type QuoteCalc = {
  /** Per-line totals, index-aligned with the input lines. */
  lineTotals: Decimal[];
  /** Per-line tax amounts, index-aligned with the input lines. */
  lineTaxes: Decimal[];
  subtotal: Decimal;
  discountAmount: Decimal;
  discountedSubtotal: Decimal;
  taxAmount: Decimal;
  total: Decimal;
};

export function calculateQuoteTotal(
  lines: CalcLine[],
  discount: CalcDiscount,
): QuoteCalc {
  // 1 + 2: per-line totals and subtotal.
  const lineTotals = lines.map((line) =>
    roundMoney(toDecimal(line.quantity).mul(toDecimal(line.unitPrice))),
  );
  const subtotal = roundMoney(sumDecimals(lineTotals));

  // 3: quote-level discount applied to the subtotal.
  let discountedSubtotal: Decimal;
  if (!discount) {
    discountedSubtotal = subtotal;
  } else if (discount.type === "PERCENT") {
    const factor = new Decimal(1).sub(toDecimal(discount.value).div(100));
    // A percent outside 0–100 cannot push the result negative in practice
    // (validated upstream), but floor at zero defensively.
    discountedSubtotal = roundMoney(
      Decimal.max(subtotal.mul(factor), new Decimal(0)),
    );
  } else {
    discountedSubtotal = roundMoney(subtractFloorZero(subtotal, toDecimal(discount.value)));
  }
  const discountAmount = roundMoney(subtotal.sub(discountedSubtotal));

  // 4: proportional tax per line against the discounted subtotal.
  const lineTaxes = lines.map((line, i) => {
    if (!line.taxRatePercent || subtotal.lessThanOrEqualTo(0)) {
      return new Decimal(0);
    }
    const share = lineTotals[i].div(subtotal); // proportion of subtotal
    const discountedLine = discountedSubtotal.mul(share);
    const rate = toDecimal(line.taxRatePercent).div(100);
    return roundMoney(discountedLine.mul(rate));
  });
  const taxAmount = roundMoney(sumDecimals(lineTaxes));

  // 5: grand total.
  const total = roundMoney(discountedSubtotal.add(taxAmount));

  return {
    lineTotals,
    lineTaxes,
    subtotal,
    discountAmount,
    discountedSubtotal,
    taxAmount,
    total,
  };
}
