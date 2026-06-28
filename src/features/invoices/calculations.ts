import type { InvoiceStatus } from "@prisma/client";

import { subtractFloorZero, toDecimal, type Decimal } from "@/lib/money";

/**
 * Invoice money helpers (Phase 5, §21). Balance is computed, never stored;
 * overdue is computed on read (no scheduled job exists to push it, §4). Pure and
 * unit-tested. Status derivation itself lives in `lib/status.deriveInvoiceStatus`.
 */

/** Outstanding balance = amount − paidAmount, floored at zero. */
export function invoiceBalance(amount: Decimal, paidAmount: Decimal): Decimal {
  return subtractFloorZero(amount, paidAmount);
}

/** Overdue = not fully paid AND past its due date (computed on read, §21). */
export function isInvoiceOverdue(
  status: InvoiceStatus,
  dueDate: Date | null,
  now: Date = new Date(),
): boolean {
  if (status === "PAID" || !dueDate) return false;
  return dueDate.getTime() < now.getTime();
}

/** Convenience overload accepting string money (from serialized DTOs). */
export function invoiceBalanceFromStrings(amount: string, paidAmount: string): Decimal {
  return invoiceBalance(toDecimal(amount), toDecimal(paidAmount));
}
