import { z } from "zod";

/**
 * Shared Zod field validators (Phase 5, §28). Money and percentage inputs are
 * validated as decimal *strings* — never parsed to a JS `number` — so float
 * precision never enters the pipeline (§5, §40). The server converts the
 * validated string to a Prisma `Decimal` via `lib/money`.
 */

const DECIMAL_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

/** A non-negative money amount with up to 2 decimal places, as a string. */
export const moneyString = z
  .string()
  .trim()
  .regex(DECIMAL_PATTERN, "Enter a valid amount, e.g. 1250.00");

/** Optional money string — empty string becomes `undefined`. */
export const optionalMoneyString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => v === undefined || DECIMAL_PATTERN.test(v), {
    message: "Enter a valid amount, e.g. 1250.00",
  });

/** A tax/discount percentage (0–100) with up to 2 decimals, as a string. */
export const percentString = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage between 0 and 100")
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, {
    message: "Percentage must be between 0 and 100",
  });

/** A positive quantity (allows decimals like 2.5 hours), as a string. */
export const quantityString = z
  .string()
  .trim()
  .regex(DECIMAL_PATTERN, "Enter a valid quantity")
  .refine((v) => Number(v) > 0, { message: "Quantity must be greater than 0" });
