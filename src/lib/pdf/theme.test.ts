import { describe, expect, it } from "vitest";

import { buildPdfBrand, hexToWash } from "@/lib/pdf/theme";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";
import type { CompanyConfig } from "@/lib/config/schema";

function config(overrides: Partial<CompanyConfig> = {}): CompanyConfig {
  return { ...DEFAULT_COMPANY_CONFIG, ...overrides };
}

describe("buildPdfBrand", () => {
  it("pulls colors from branding and currency/date from locale", () => {
    const brand = buildPdfBrand(
      { name: "Acme Plumbing", logoUrl: null },
      config({
        branding: { primaryColor: "#16243B", accentColor: "#F2994A" },
        locale: { currency: "USD", dateFormat: "MM/DD/YYYY" },
      }),
    );
    expect(brand.companyName).toBe("Acme Plumbing");
    expect(brand.colors.primary).toBe("#16243B");
    expect(brand.colors.accent).toBe("#F2994A");
    expect(brand.currency).toBe("USD");
  });

  it("only shows the logo when configured AND a logo URL exists", () => {
    const withLogo = buildPdfBrand(
      { name: "Acme", logoUrl: "https://cdn.test/logo.png" },
      config({ pdf: { ...DEFAULT_COMPANY_CONFIG.pdf, showLogo: true } }),
    );
    expect(withLogo.showLogo).toBe(true);

    const noUrl = buildPdfBrand(
      { name: "Acme", logoUrl: null },
      config({ pdf: { ...DEFAULT_COMPANY_CONFIG.pdf, showLogo: true } }),
    );
    expect(noUrl.showLogo).toBe(false);

    const disabled = buildPdfBrand(
      { name: "Acme", logoUrl: "https://cdn.test/logo.png" },
      config({ pdf: { ...DEFAULT_COMPANY_CONFIG.pdf, showLogo: false } }),
    );
    expect(disabled.showLogo).toBe(false);
  });
});

describe("hexToWash", () => {
  it("produces a pale tint near white from a brand color", () => {
    const wash = hexToWash("#000000");
    // 86% toward white from black ≈ #DB / 0xDB on each channel.
    expect(wash).toMatch(/^#[0-9a-f]{6}$/);
    const channel = parseInt(wash.slice(1, 3), 16);
    expect(channel).toBeGreaterThan(0xcc);
  });

  it("falls back to a neutral wash for a malformed hex", () => {
    expect(hexToWash("not-a-color")).toBe("#EFEFEF");
  });

  it("supports 3-digit shorthand hex", () => {
    expect(hexToWash("#fff")).toBe("#ffffff");
  });
});
