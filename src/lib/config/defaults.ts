import { CURRENT_CONFIG_VERSION } from "@/lib/config/migrations";
import type { CompanyConfig } from "@/lib/config/schema";

/**
 * The default Company Configuration (Phase 4, §5.1, §5.2, §20).
 *
 * Built section-by-section so a new section ships with its own defaults rather
 * than a patch to one giant object. `version` always equals
 * `CURRENT_CONFIG_VERSION` (enforced by a Step 3 unit test). Every read merges a
 * tenant's stored JSON onto this object, so any key a tenant hasn't set yet
 * falls back here.
 *
 * Feature flags default exactly to §20: everything `false` except `invoicing`,
 * which is part of the Standard package and already backed by the Phase 2 schema.
 */
export const DEFAULT_COMPANY_CONFIG: CompanyConfig = {
  version: CURRENT_CONFIG_VERSION,
  branding: {
    primaryColor: "#16243B",
    accentColor: "#F2994A",
  },
  businessHours: {
    timezone: "UTC",
  },
  locale: {
    currency: "USD",
    dateFormat: "MM/DD/YYYY",
  },
  taxation: {
    defaultTaxRatePercent: 0,
  },
  numbering: {
    quotePrefix: "Q",
    invoicePrefix: "INV",
    padding: 4,
    resetPolicy: "never",
  },
  pdf: {
    headerText: "",
    footerText: "",
    showLogo: true,
  },
  email: {
    quoteSentSubjectTemplate: "Your quote from {{companyName}}",
    quoteSentBodyTemplate: "",
  },
  featureFlags: {
    ai: false,
    portal: false,
    automation: false,
    advancedReports: false,
    invoicing: true,
    integrations: false,
  },
  integrations: {},
};
