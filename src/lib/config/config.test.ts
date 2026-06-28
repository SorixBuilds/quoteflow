import { describe, expect, it } from "vitest";

import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";
import { deepMerge } from "@/lib/config/merge";
import {
  CURRENT_CONFIG_VERSION,
  migrateToLatest,
} from "@/lib/config/migrations";
import { CompanyConfigSchema } from "@/lib/config/schema";

/** Mirror the Configuration Service read path for testing (§5.5). */
function parseStored(raw: unknown) {
  return CompanyConfigSchema.parse(
    deepMerge(DEFAULT_COMPANY_CONFIG, migrateToLatest(raw)),
  );
}

describe("DEFAULT_COMPANY_CONFIG", () => {
  it("matches CURRENT_CONFIG_VERSION", () => {
    expect(DEFAULT_COMPANY_CONFIG.version).toBe(CURRENT_CONFIG_VERSION);
  });

  it("is itself valid against the schema", () => {
    expect(CompanyConfigSchema.safeParse(DEFAULT_COMPANY_CONFIG).success).toBe(
      true,
    );
  });

  it("defaults feature flags to the spec values (§20)", () => {
    expect(DEFAULT_COMPANY_CONFIG.featureFlags).toEqual({
      ai: false,
      portal: false,
      automation: false,
      advancedReports: false,
      invoicing: true,
      integrations: false,
    });
  });
});

describe("config read path — parse(deepMerge(defaults, migrated))", () => {
  it("fills a completely empty {} with defaults", () => {
    expect(parseStored({})).toEqual(DEFAULT_COMPANY_CONFIG);
  });

  it("fills a null/garbage stored value with defaults", () => {
    expect(parseStored(null)).toEqual(DEFAULT_COMPANY_CONFIG);
    expect(parseStored("not an object")).toEqual(DEFAULT_COMPANY_CONFIG);
  });

  it("merges a partial section without dropping its other keys", () => {
    const result = parseStored({ branding: { primaryColor: "#000000" } });
    expect(result.branding.primaryColor).toBe("#000000");
    // accentColor was not provided — falls back to default.
    expect(result.branding.accentColor).toBe(
      DEFAULT_COMPANY_CONFIG.branding.accentColor,
    );
  });

  it("preserves untouched sections when one section is partially set", () => {
    const result = parseStored({ locale: { currency: "EUR" } });
    expect(result.locale.currency).toBe("EUR");
    expect(result.numbering).toEqual(DEFAULT_COMPANY_CONFIG.numbering);
    expect(result.featureFlags).toEqual(DEFAULT_COMPANY_CONFIG.featureFlags);
  });

  it("rejects an invalid value after merge (e.g. a bad hex color)", () => {
    expect(() => parseStored({ branding: { primaryColor: "blue" } })).toThrow();
  });
});

describe("migrateToLatest", () => {
  it("stamps the current version onto a legacy blob", () => {
    expect(migrateToLatest({}).version).toBe(CURRENT_CONFIG_VERSION);
  });

  it("is idempotent for an already-current document", () => {
    const once = migrateToLatest(DEFAULT_COMPANY_CONFIG);
    const twice = migrateToLatest(once);
    expect(twice).toEqual(once);
  });
});

describe("deepMerge", () => {
  it("merges nested plain objects recursively", () => {
    expect(deepMerge({ a: { x: 1, y: 2 } }, { a: { y: 9 } })).toEqual({
      a: { x: 1, y: 9 },
    });
  });

  it("ignores undefined values in the source", () => {
    expect(deepMerge({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
  });

  it("replaces primitives and does not mutate the target", () => {
    const target = { a: 1, b: { c: 2 } };
    const merged = deepMerge(target, { a: 5 });
    expect(merged).toEqual({ a: 5, b: { c: 2 } });
    expect(target.a).toBe(1);
  });
});
