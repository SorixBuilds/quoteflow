import { Decimal, sumDecimals, toDecimal } from "@/lib/money";

/**
 * Revenue forecasting math (Phase 6B Step 10, §17.5).
 *
 * A LINEAR projection over recent monthly collected-payment totals —
 * explicitly simple by design ("not a statistical model … no premature
 * sophistication"). Ordinary least squares over (monthIndex, monthTotal),
 * evaluated one month past the window; floored at zero (a declining trend
 * forecasts 0, never negative revenue). Pure and Decimal-in / string-out so
 * the money discipline (§5) holds and every branch is unit-testable.
 */

export type MonthlyTotal = {
  /** First day of the month, UTC. */
  month: Date;
  /** Collected payments in that month. */
  total: Decimal;
};

export type RevenueForecast = {
  months: { label: string; total: string }[];
  /** Projected next-month total ("0.00"-floored), or null with <2 months of data. */
  nextMonth: string | null;
  trend: "up" | "down" | "flat" | null;
};

/** Least-squares slope/intercept over equally spaced month indexes. */
export function linearForecast(totals: MonthlyTotal[]): RevenueForecast {
  const months = totals.map((m) => ({
    label: m.month.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }),
    total: m.total.toFixed(2),
  }));

  if (totals.length < 2) {
    return { months, nextMonth: null, trend: null };
  }

  const n = totals.length;
  const values = totals.map((m) => m.total);
  const sumX = (n * (n - 1)) / 2;
  const sumXX = totals.reduce((acc, _, i) => acc + i * i, 0);
  const sumY = sumDecimals(values);
  const sumXY = sumDecimals(values.map((v, i) => v.mul(i)));

  // slope = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²); denominator > 0 for n ≥ 2.
  const denominator = n * sumXX - sumX * sumX;
  const slope = sumXY.mul(n).sub(sumY.mul(sumX)).div(denominator);
  const intercept = sumY.sub(slope.mul(sumX)).div(n);

  const projected = slope.mul(n).add(intercept);
  const floored = projected.isNegative() ? toDecimal(0) : projected;

  const epsilon = toDecimal("0.005");
  const trend = slope.greaterThan(epsilon) ? "up" : slope.lessThan(epsilon.neg()) ? "down" : "flat";

  return { months, nextMonth: floored.toFixed(2), trend };
}
