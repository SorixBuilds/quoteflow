import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatNumber,
  getNextInvoiceNumber,
  getNextQuoteNumber,
} from "@/lib/numbering";
import { db } from "@/lib/db";
import { getCompanyConfig } from "@/lib/config/service";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";

vi.mock("@/lib/db", () => ({
  db: { organization: { update: vi.fn() } },
}));

vi.mock("@/lib/config/service", () => ({
  getCompanyConfig: vi.fn(),
}));

describe("formatNumber", () => {
  it("pads the sequence and joins with the prefix", () => {
    expect(formatNumber("Q", 41, 4)).toBe("Q-0041");
    expect(formatNumber("INV", 1, 4)).toBe("INV-0001");
  });

  it("does not truncate a sequence longer than the padding", () => {
    expect(formatNumber("Q", 12345, 4)).toBe("Q-12345");
  });

  it("omits the separator when there is no prefix", () => {
    expect(formatNumber("", 7, 3)).toBe("007");
  });
});

describe("getNextQuoteNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCompanyConfig).mockResolvedValue(DEFAULT_COMPANY_CONFIG);
  });

  it("uses a single atomic increment and formats sequence = counter - 1", async () => {
    // A fresh org's counter is 1; the first claim increments it to 2 and the
    // post-increment value (2) is returned, so the first sequence is 1.
    vi.mocked(db.organization.update).mockResolvedValue({
      nextQuoteNumber: 2,
    } as never);

    const result = await getNextQuoteNumber("org-1");

    expect(db.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { nextQuoteNumber: { increment: 1 } },
      select: { nextQuoteNumber: true },
    });
    expect(result).toBe("Q-0001");
  });

  it("increments across calls", async () => {
    vi.mocked(db.organization.update)
      .mockResolvedValueOnce({ nextQuoteNumber: 2 } as never)
      .mockResolvedValueOnce({ nextQuoteNumber: 3 } as never);

    expect(await getNextQuoteNumber("org-1")).toBe("Q-0001");
    expect(await getNextQuoteNumber("org-1")).toBe("Q-0002");
  });
});

describe("getNextInvoiceNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCompanyConfig).mockResolvedValue(DEFAULT_COMPANY_CONFIG);
  });

  it("uses the invoice counter column and prefix", async () => {
    vi.mocked(db.organization.update).mockResolvedValue({
      nextInvoiceNumber: 5,
    } as never);

    const result = await getNextInvoiceNumber("org-1");

    expect(db.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { nextInvoiceNumber: { increment: 1 } },
      select: { nextInvoiceNumber: true },
    });
    expect(result).toBe("INV-0004");
  });
});

/**
 * Concurrency property (§23, §24). A true two-client race requires a live
 * Postgres test DB; here we prove the *contract* the atomic column relies on:
 * given N callers each receiving a strictly-increasing post-increment value
 * (exactly what `UPDATE ... { increment: 1 } RETURNING` guarantees under row
 * locking), every claimed sequence is unique. The real-DB variant is documented
 * in the Phase 4 report and runnable behind a TEST_DATABASE_URL flag.
 */
describe("numbering concurrency contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCompanyConfig).mockResolvedValue(DEFAULT_COMPANY_CONFIG);
  });

  it("never returns a duplicate when the counter increments atomically", async () => {
    let counter = 1;
    vi.mocked(db.organization.update).mockImplementation(
      (() => Promise.resolve({ nextQuoteNumber: ++counter })) as never,
    );

    const results = await Promise.all(
      Array.from({ length: 50 }, () => getNextQuoteNumber("org-1")),
    );

    expect(new Set(results).size).toBe(results.length);
  });
});
