import { db } from "@/lib/db";
import { getCompanyConfig } from "@/lib/config/service";

/**
 * Atomic quote/invoice numbering (Phase 4, §29, §5.6).
 *
 * The human-facing reference number is assembled from two sources, deliberately
 * split:
 *  - the *format* (prefix, padding) lives in `CompanyConfig.numbering` — read
 *    through the Configuration Service, never `Organization.settings` directly.
 *  - the *counter* lives in the dedicated `Organization.nextQuoteNumber` /
 *    `nextInvoiceNumber` Int columns, incremented with a single atomic
 *    `UPDATE ... { increment: 1 }` statement. Postgres' own row-level locking
 *    serializes concurrent callers, so two quotes for one org can never claim
 *    the same sequence — no JSON read-modify-write, no manual transaction.
 *
 * Server-only: imports Prisma.
 */

/** `formatNumber("Q", 41, 4)` → `"Q-0041"`. Pure and unit-testable. */
export function formatNumber(
  prefix: string,
  sequence: number,
  padding: number,
): string {
  const padded = String(sequence).padStart(padding, "0");
  return prefix ? `${prefix}-${padded}` : padded;
}

/**
 * Claim the next quote number for an organization. The increment is a single
 * atomic statement; the claimed sequence is the value *before* this call
 * (counter starts at 1, so the first quote is sequence 1).
 */
export async function getNextQuoteNumber(
  organizationId: string,
): Promise<string> {
  const org = await db.organization.update({
    where: { id: organizationId },
    data: { nextQuoteNumber: { increment: 1 } },
    select: { nextQuoteNumber: true },
  });
  const sequence = org.nextQuoteNumber - 1;
  const { numbering } = await getCompanyConfig(organizationId);
  return formatNumber(numbering.quotePrefix, sequence, numbering.padding);
}

/** Invoice counterpart of {@link getNextQuoteNumber}. */
export async function getNextInvoiceNumber(
  organizationId: string,
): Promise<string> {
  const org = await db.organization.update({
    where: { id: organizationId },
    data: { nextInvoiceNumber: { increment: 1 } },
    select: { nextInvoiceNumber: true },
  });
  const sequence = org.nextInvoiceNumber - 1;
  const { numbering } = await getCompanyConfig(organizationId);
  return formatNumber(numbering.invoicePrefix, sequence, numbering.padding);
}
