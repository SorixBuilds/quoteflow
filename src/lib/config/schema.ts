import { z } from "zod";

/**
 * Company Configuration schema (Phase 4, §5.1, §5.2, §12).
 *
 * The versioned, sectioned shape of the tenant's `Organization.settings` JSON
 * column. One Zod sub-schema per section; `CompanyConfigSchema` is their
 * composition. Every read goes through
 * `CompanyConfigSchema.parse(deepMerge(DEFAULT_COMPANY_CONFIG, migrated))`, so a
 * partial, legacy, or pre-version-bump blob never crashes a page.
 *
 * This schema is the canonical validation example for the whole product (§12).
 */

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const BrandingSchema = z.object({
  primaryColor: z.string().regex(HEX_COLOR, "Must be a hex color, e.g. #16243B"),
  accentColor: z.string().regex(HEX_COLOR, "Must be a hex color, e.g. #F2994A"),
});

/** A single day's open/close window; `null` means closed that day. */
export const DayHoursSchema = z
  .object({
    open: z.string(),
    close: z.string(),
  })
  .nullable();

export const BusinessHoursSchema = z.object({
  timezone: z.string().min(1),
  // Optional per-day schedule keyed by day name (e.g. "monday").
  schedule: z.record(z.string(), DayHoursSchema).optional(),
});

export const LocaleSchema = z.object({
  currency: z.string().length(3, "Must be a 3-letter ISO 4217 code"),
  dateFormat: z.string().min(1),
});

export const TaxationSchema = z.object({
  defaultTaxRatePercent: z.number().min(0).max(100),
});

export const NumberingSchema = z.object({
  quotePrefix: z.string().max(8),
  invoicePrefix: z.string().max(8),
  padding: z.number().int().min(0).max(10),
  // "yearly" requires an explicit manual reset action, never an automatic one.
  resetPolicy: z.enum(["never", "yearly"]),
});

export const PdfSchema = z.object({
  headerText: z.string(),
  footerText: z.string(),
  showLogo: z.boolean(),
});

export const EmailSchema = z.object({
  // Placeholder templates only — no email is actually sent in V1 (Resend deferred).
  quoteSentSubjectTemplate: z.string(),
  quoteSentBodyTemplate: z.string(),
});

export const FeatureFlagsSchema = z.object({
  ai: z.boolean(),
  portal: z.boolean(),
  automation: z.boolean(),
  advancedReports: z.boolean(),
  invoicing: z.boolean(),
  integrations: z.boolean(),
});

export const IntegrationsSchema = z.record(z.string(), z.unknown());

export const CompanyConfigSchema = z.object({
  version: z.number().int().positive(),
  branding: BrandingSchema,
  businessHours: BusinessHoursSchema,
  locale: LocaleSchema,
  taxation: TaxationSchema,
  numbering: NumberingSchema,
  pdf: PdfSchema,
  email: EmailSchema,
  featureFlags: FeatureFlagsSchema,
  integrations: IntegrationsSchema,
});

export type CompanyConfig = z.infer<typeof CompanyConfigSchema>;
export type Branding = z.infer<typeof BrandingSchema>;
export type BusinessHours = z.infer<typeof BusinessHoursSchema>;
export type Locale = z.infer<typeof LocaleSchema>;
export type Taxation = z.infer<typeof TaxationSchema>;
export type Numbering = z.infer<typeof NumberingSchema>;
export type PdfConfig = z.infer<typeof PdfSchema>;
export type EmailConfig = z.infer<typeof EmailSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

/** The set of feature flag keys, derived from the schema (single source). */
export type FeatureFlagKey = keyof FeatureFlags;

/**
 * A partial config for writes: every section is optional, and within a section
 * every key is optional. The Configuration Service section-merges this into the
 * current full config before validating (§5.5).
 */
export type CompanyConfigPatch = {
  [K in keyof Omit<CompanyConfig, "version">]?: Partial<CompanyConfig[K]>;
};
