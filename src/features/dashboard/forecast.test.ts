import { describe, expect, it } from "vitest";

import { linearForecast } from "@/features/dashboard/forecast";
import { toDecimal } from "@/lib/money";

/**
 * §17.5: the forecast is a plain least-squares line over monthly totals —
 * rising data projects above the last month, falling data below (floored at
 * zero), and fewer than two months yields no projection.
 */

const month = (iso: string) => new Date(iso);
const totals = (values: [string, string][]) =>
  values.map(([iso, total]) => ({ month: month(iso), total: toDecimal(total) }));

describe("linearForecast (§17.5)", () => {
  it("projects the next point of a perfect linear trend exactly", () => {
    const result = linearForecast(
      totals([
        ["2026-01-01T00:00:00Z", "100.00"],
        ["2026-02-01T00:00:00Z", "200.00"],
        ["2026-03-01T00:00:00Z", "300.00"],
      ]),
    );
    expect(result.nextMonth).toBe("400.00");
    expect(result.trend).toBe("up");
    expect(result.months).toHaveLength(3);
    expect(result.months[0].label).toContain("Jan");
  });

  it("floors a declining projection at zero — never negative revenue", () => {
    const result = linearForecast(
      totals([
        ["2026-01-01T00:00:00Z", "300.00"],
        ["2026-02-01T00:00:00Z", "100.00"],
      ]),
    );
    expect(result.trend).toBe("down");
    expect(result.nextMonth).toBe("0.00");
  });

  it("reports a flat trend for constant totals", () => {
    const result = linearForecast(
      totals([
        ["2026-01-01T00:00:00Z", "250.00"],
        ["2026-02-01T00:00:00Z", "250.00"],
        ["2026-03-01T00:00:00Z", "250.00"],
      ]),
    );
    expect(result.trend).toBe("flat");
    expect(result.nextMonth).toBe("250.00");
  });

  it("declines to project with fewer than two months of data", () => {
    expect(linearForecast(totals([["2026-01-01T00:00:00Z", "500.00"]]))).toEqual({
      months: [{ label: "Jan 2026", total: "500.00" }],
      nextMonth: null,
      trend: null,
    });
    expect(linearForecast([])).toEqual({ months: [], nextMonth: null, trend: null });
  });
});
