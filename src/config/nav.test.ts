import { describe, expect, it } from "vitest";

import { filterNav } from "@/config/nav";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";

const flags = DEFAULT_COMPANY_CONFIG.featureFlags;
const labels = (role: Parameters<typeof filterNav>[0], f = flags) =>
  filterNav(role, f).map((i) => i.label);

describe("filterNav — role filtering (§8)", () => {
  it("OWNER sees the full standard nav (§10 order)", () => {
    expect(labels("OWNER")).toEqual([
      "Dashboard",
      "Leads",
      "Quotes",
      "Jobs",
      "Invoices",
      "Customers",
      "Reports",
      "Catalog",
      "Settings",
    ]);
  });

  it("STAFF sees everything except Settings (§11)", () => {
    const result = labels("STAFF");
    expect(result).toContain("Dashboard");
    expect(result).toContain("Reports");
    expect(result).toContain("Catalog");
    expect(result).not.toContain("Settings");
  });

  it("FIELD sees only Jobs", () => {
    expect(labels("FIELD")).toEqual(["Jobs"]);
  });
});

describe("filterNav — feature-flag gating (§20)", () => {
  it("hides a flagged item when its flag is false (default)", () => {
    expect(labels("OWNER")).not.toContain("Automations");
  });

  it("shows the flagged item once the flag is true", () => {
    expect(labels("OWNER", { ...flags, automation: true })).toContain(
      "Automations",
    );
  });

  it("still respects role even when the flag is on", () => {
    expect(labels("FIELD", { ...flags, automation: true })).not.toContain(
      "Automations",
    );
  });
});
