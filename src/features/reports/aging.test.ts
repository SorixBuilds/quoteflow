import { describe, expect, it } from "vitest";

import { bucketByAge } from "@/features/reports/aging";

/**
 * §18.12: bucketByAge boundary conditions — exactly 30/60/90 days sit in the
 * lower bucket, day 31/61/91 opens the next; no-due-date and not-yet-due rows
 * are "current"; fully paid rows contribute nothing.
 */

const NOW = new Date("2026-07-02T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

function invoice(amount: string, paid: string, dueDaysAgo: number | null) {
  return {
    amount,
    paidAmount: paid,
    dueDate: dueDaysAgo === null ? null : daysAgo(dueDaysAgo),
  };
}

describe("bucketByAge (§18.6)", () => {
  it("places exact 30/60/90-day boundaries in the lower bucket", () => {
    const buckets = bucketByAge(
      [
        invoice("100.00", "0.00", 30),
        invoice("200.00", "0.00", 31),
        invoice("300.00", "0.00", 60),
        invoice("400.00", "0.00", 61),
        invoice("500.00", "0.00", 90),
        invoice("600.00", "0.00", 91),
      ],
      NOW,
    );
    expect(buckets["0-30"]).toEqual({ total: "100.00", count: 1 });
    expect(buckets["31-60"]).toEqual({ total: "500.00", count: 2 }); // 31d + 60d
    expect(buckets["61-90"]).toEqual({ total: "900.00", count: 2 }); // 61d + 90d
    expect(buckets["90+"]).toEqual({ total: "600.00", count: 1 });
  });

  it("treats not-yet-due and no-due-date invoices as current", () => {
    const buckets = bucketByAge(
      [invoice("50.00", "0.00", -5), invoice("70.00", "20.00", null)],
      NOW,
    );
    expect(buckets.current).toEqual({ total: "100.00", count: 2 }); // 50 + (70−20)
  });

  it("uses outstanding balance (amount − paid, floored) and skips settled rows", () => {
    const buckets = bucketByAge(
      [invoice("100.00", "100.00", 45), invoice("100.00", "150.00", 45), invoice("100.00", "40.00", 45)],
      NOW,
    );
    expect(buckets["31-60"]).toEqual({ total: "60.00", count: 1 });
  });

  it("returns all-zero buckets for no invoices", () => {
    const buckets = bucketByAge([], NOW);
    for (const key of ["current", "0-30", "31-60", "61-90", "90+"] as const) {
      expect(buckets[key]).toEqual({ total: "0.00", count: 0 });
    }
  });
});
