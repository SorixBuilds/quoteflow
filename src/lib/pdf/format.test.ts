import { describe, expect, it } from "vitest";

import { formatAddressLines, formatDocDate } from "@/lib/pdf/format";

describe("formatDocDate", () => {
  it("formats a date as deterministic DD Mon YYYY (UTC)", () => {
    expect(formatDocDate(new Date("2026-06-28T00:00:00Z"))).toBe("28 Jun 2026");
  });

  it("accepts an ISO string", () => {
    expect(formatDocDate("2026-01-05T12:00:00Z")).toBe("05 Jan 2026");
  });

  it("renders an em dash for null/empty/invalid input", () => {
    expect(formatDocDate(null)).toBe("—");
    expect(formatDocDate(undefined)).toBe("—");
    expect(formatDocDate("")).toBe("—");
    expect(formatDocDate("not-a-date")).toBe("—");
  });
});

describe("formatAddressLines", () => {
  it("splits a multi-line string address", () => {
    expect(formatAddressLines("12 King St\nSpringfield")).toEqual(["12 King St", "Springfield"]);
  });

  it("assembles a structured object in postal order", () => {
    expect(
      formatAddressLines({
        line1: "12 King St",
        city: "Springfield",
        state: "IL",
        postalCode: "62704",
        country: "USA",
      }),
    ).toEqual(["12 King St", "Springfield, IL, 62704", "USA"]);
  });

  it("returns no lines for null or unknown shapes", () => {
    expect(formatAddressLines(null)).toEqual([]);
    expect(formatAddressLines(42)).toEqual([]);
  });
});
