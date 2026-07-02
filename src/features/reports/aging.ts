import { Decimal, subtractFloorZero, toDecimal } from "@/lib/money";

/**
 * AR aging buckets (Phase 6B Step 10, §18.5/§18.6) — the pure function behind
 * the Aging report, unit-tested independent of the query exactly as the
 * architecture sketches. Buckets are days past `dueDate`: current (not yet
 * due, or no due date), 0–30, 31–60, 61–90, 90+. Day boundaries are inclusive
 * of the lower edge: an invoice exactly 30 days past due sits in 0–30; day 31
 * opens the next bucket.
 */

export type AgeableInvoice = {
  amount: Decimal | string | number;
  paidAmount: Decimal | string | number;
  dueDate: Date | null;
};

export const AGING_BUCKETS = ["current", "0-30", "31-60", "61-90", "90+"] as const;
export type AgingBucketKey = (typeof AGING_BUCKETS)[number];

export type AgingBuckets = Record<AgingBucketKey, { total: string; count: number }>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function bucketFor(daysPastDue: number | null): AgingBucketKey {
  if (daysPastDue === null || daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "0-30";
  if (daysPastDue <= 60) return "31-60";
  if (daysPastDue <= 90) return "61-90";
  return "90+";
}

/** Bucket outstanding balances by age; zero-balance rows contribute nothing. */
export function bucketByAge(invoices: AgeableInvoice[], now: Date): AgingBuckets {
  const totals = new Map<AgingBucketKey, { sum: Decimal; count: number }>(
    AGING_BUCKETS.map((key) => [key, { sum: toDecimal(0), count: 0 }]),
  );

  for (const invoice of invoices) {
    const balance = subtractFloorZero(toDecimal(invoice.amount), toDecimal(invoice.paidAmount));
    if (balance.isZero()) continue;

    const daysPastDue = invoice.dueDate
      ? Math.floor((now.getTime() - invoice.dueDate.getTime()) / MS_PER_DAY)
      : null;
    const bucket = totals.get(bucketFor(daysPastDue))!;
    bucket.sum = bucket.sum.add(balance);
    bucket.count += 1;
  }

  return Object.fromEntries(
    [...totals.entries()].map(([key, value]) => [
      key,
      { total: value.sum.toFixed(2), count: value.count },
    ]),
  ) as AgingBuckets;
}
