import { Prisma } from "@prisma/client";

/**
 * Money primitives (Phase 5, §5 "Decimal correctness"). Every monetary value in
 * the business pipeline is a Prisma `Decimal` end-to-end — never a JS `number`
 * or `Float` — so totals, tax, and balances never accumulate floating-point
 * drift. This module is the single, shared surface for constructing, rounding,
 * comparing, and formatting that `Decimal`.
 *
 * The re-exported `Decimal` constructor is `@prisma/client`'s bundled Decimal.js,
 * so callers never reach into `@prisma/client/runtime` directly.
 */

export const Decimal = Prisma.Decimal;
export type Decimal = Prisma.Decimal;

/** Money is stored at 2 decimal places (`@db.Decimal(10, 2)`). */
export const MONEY_SCALE = 2;

/**
 * Coerce a string | number | Decimal into a `Decimal`. Strings are the primary
 * input shape (form fields are validated as decimal strings, §28) precisely so a
 * value never passes through a JS `number` on the way in.
 */
export function toDecimal(
  value: string | number | Prisma.Decimal | null | undefined,
): Prisma.Decimal {
  if (value === null || value === undefined || value === "") {
    return new Prisma.Decimal(0);
  }
  return new Prisma.Decimal(value);
}

/** Round to money scale using half-up (banker-free) rounding. */
export function roundMoney(value: Prisma.Decimal): Prisma.Decimal {
  return value.toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

/** Sum a list of decimals, starting from 0. */
export function sumDecimals(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce(
    (acc, v) => acc.add(v),
    new Prisma.Decimal(0),
  );
}

/** `a` minus `b`, floored at zero (used for balances / fixed discounts). */
export function subtractFloorZero(
  a: Prisma.Decimal,
  b: Prisma.Decimal,
): Prisma.Decimal {
  const result = a.sub(b);
  return result.isNegative() ? new Prisma.Decimal(0) : result;
}

/**
 * Format a money value using the org's ISO-4217 currency. Pure and isomorphic
 * (server + client) — backs the `<MoneyDisplay>` component. The `Decimal` is
 * converted to `number` *only* at the final formatting boundary, never for
 * arithmetic.
 */
export function formatMoney(
  value: string | number | Prisma.Decimal,
  currency: string,
  locale?: string,
): string {
  const decimal = toDecimal(value);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(decimal.toNumber());
  } catch {
    // Unknown/invalid currency code — fall back to a plain 2dp number with the
    // code appended, rather than throwing in a render path.
    return `${currency} ${decimal.toFixed(MONEY_SCALE)}`;
  }
}

/** Serialize a `Decimal` to its canonical 2dp string (for client payloads). */
export function moneyToString(value: Prisma.Decimal): string {
  return value.toFixed(MONEY_SCALE);
}
