/**
 * Static application metadata. Anything that is configuration rather than
 * content or business data lives here so it has a single source of truth.
 */
export const siteConfig = {
  name: "QuoteFlow",
  description:
    "A lead-to-job pipeline system for home service contractors — from first call to signed job, without anything falling through the cracks.",
  url: "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;
