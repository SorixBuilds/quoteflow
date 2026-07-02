import type { CompanyConfig } from "@/lib/config/schema";

/**
 * PDF theme (Phase 6, §10.4) — the single place document branding is derived
 * from the tenant's configuration. Every template and shared component receives
 * one `PdfBrand` object built here; none of them reads `lib/config` or the
 * `Organization` row directly, so the colors/typography of all five document
 * types stay consistent and a branding change touches exactly one function.
 *
 * Pure and dependency-free (no `@react-pdf/renderer` import) so it is trivially
 * unit-testable. Colors come from `config.branding`; identity (name/logo) from
 * the `Organization` row; currency/date format from `config.locale`.
 */

/** The minimal slice of the `Organization` row a document needs for identity. */
export type PdfOrganization = {
  name: string;
  logoUrl: string | null;
};

/** The resolved branding bundle handed to every template and component. */
export type PdfBrand = {
  companyName: string;
  logoUrl: string | null;
  showLogo: boolean;
  headerText: string;
  footerText: string;
  currency: string;
  dateFormat: string;
  colors: {
    primary: string;
    accent: string;
    text: string;
    muted: string;
    border: string;
    tableHeaderText: string;
    watermark: string;
    zebra: string;
  };
};

/** Neutral, print-safe greys used uniformly across documents (not tenant-configurable). */
const NEUTRALS = {
  text: "#1A1A1A",
  muted: "#6B7280",
  border: "#D1D5DB",
  tableHeaderText: "#FFFFFF",
  zebra: "#F5F6F8",
} as const;

/**
 * Build the document brand bundle from the tenant's organization row + config.
 * `showLogo` is honored only when a logo URL actually exists.
 */
export function buildPdfBrand(
  organization: PdfOrganization,
  config: CompanyConfig,
): PdfBrand {
  return {
    companyName: organization.name,
    logoUrl: organization.logoUrl,
    showLogo: config.pdf.showLogo && Boolean(organization.logoUrl),
    headerText: config.pdf.headerText,
    footerText: config.pdf.footerText,
    currency: config.locale.currency,
    dateFormat: config.locale.dateFormat,
    colors: {
      primary: config.branding.primaryColor,
      accent: config.branding.accentColor,
      text: NEUTRALS.text,
      muted: NEUTRALS.muted,
      border: NEUTRALS.border,
      tableHeaderText: NEUTRALS.tableHeaderText,
      // A pale wash derived from the brand accent — light enough to print behind text.
      watermark: hexToWash(config.branding.accentColor),
      zebra: NEUTRALS.zebra,
    },
  };
}

/**
 * Map any brand color to a very pale tint suitable for a watermark/background —
 * blends the color 90% toward white so a "DRAFT"/"PAID" stamp never overwhelms
 * the document body. Falls back to a neutral grey wash for a malformed hex.
 */
export function hexToWash(hex: string): string {
  const parsed = parseHex(hex);
  if (!parsed) return "#EFEFEF";
  const wash = (channel: number) => Math.round(channel + (255 - channel) * 0.86);
  return rgbToHex(wash(parsed.r), wash(parsed.g), wash(parsed.b));
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  let body = match[1];
  if (body.length === 3) {
    body = body
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return {
    r: parseInt(body.slice(0, 2), 16),
    g: parseInt(body.slice(2, 4), 16),
    b: parseInt(body.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
