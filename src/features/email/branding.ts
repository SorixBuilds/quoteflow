import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getCompanyConfig } from "@/lib/config/service";
import type { CompanyConfig } from "@/lib/config/schema";

/**
 * Email branding & sender identity (Phase 6B Step 5, §9, §11.9).
 *
 * The single place an outbound email's identity (from/reply-to/sender name) and
 * its visual branding (logo, colors, footer, signature) are derived — always
 * server-side, from the tenant's `Organization` row + Company Configuration,
 * never from anything a client supplied (§11.9 closes header injection and
 * template injection as categories). Mirrors `lib/pdf/theme.buildPdfBrand` so an
 * email and a PDF for the same tenant brand consistently.
 *
 * Server-only: imports Prisma and the Configuration Service.
 */

/** The resolved sender identity for one tenant's outbound mail. */
export type EmailSender = {
  /** RFC 5322 `from` value, e.g. `Acme Co <no-reply@quoteflow.app>`. */
  from: string;
  /** Bare address used for the `EmailLog.fromEmail` column (must be a valid email). */
  fromEmail: string;
  /** Optional reply-to address, or null when the tenant has not set one. */
  replyTo: string | null;
};

/** The branding bundle every template's layout consumes. */
export type EmailBrand = {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  footer: string;
  signature: string;
  /** Public app base URL, for absolute links inside the email body. */
  appUrl: string;
};

/** The full per-tenant context handed to the rendering pipeline. */
export type EmailContext = {
  organizationId: string;
  sender: EmailSender;
  brand: EmailBrand;
};

/**
 * Derive the tenant's `from`/`reply-to`. The sender address is the tenant's
 * configured `senderEmail` when present, else the platform default
 * (`EMAIL_FROM_DEFAULT`) — never a value from the triggering request. The
 * display name defaults to the organization name when `senderName` is blank.
 */
export function buildEmailSender(
  organizationName: string,
  config: CompanyConfig,
): EmailSender {
  const fromEmail = config.email.senderEmail || env.EMAIL_FROM_DEFAULT;
  const displayName = (config.email.senderName || organizationName).trim();
  // Quote the display name if it contains characters RFC 5322 would treat as
  // specials, and strip any CR/LF defensively (header-injection guard, §11.9).
  const safeName = displayName.replace(/[\r\n]+/g, " ").trim();
  const from = safeName ? `${quoteDisplayName(safeName)} <${fromEmail}>` : fromEmail;
  return {
    from,
    fromEmail,
    replyTo: config.email.replyTo || null,
  };
}

/** RFC 5322 quoting for a display name containing specials. */
function quoteDisplayName(name: string): string {
  if (/[(),.:;<>@\[\]"]/.test(name)) {
    return `"${name.replace(/["\\]/g, "\\$&")}"`;
  }
  return name;
}

/** Build the branding bundle from a tenant's org row + config. */
export function buildEmailBrand(
  organization: { name: string; logoUrl: string | null },
  config: CompanyConfig,
): EmailBrand {
  return {
    companyName: organization.name,
    logoUrl: organization.logoUrl,
    primaryColor: config.branding.primaryColor,
    accentColor: config.branding.accentColor,
    footer: config.email.footer,
    signature: config.email.signature,
    appUrl: env.NEXT_PUBLIC_APP_URL,
  };
}

/**
 * Load the full email context (sender + brand) for one tenant. One round trip
 * for the org identity, reusing the cached Configuration Service for everything
 * else. Throws only if the organization does not exist (a programming error —
 * the caller already proved org scope).
 */
export async function getEmailContext(organizationId: string): Promise<EmailContext> {
  const [org, config] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { name: true, logoUrl: true },
    }),
    getCompanyConfig(organizationId),
  ]);
  return {
    organizationId,
    sender: buildEmailSender(org.name, config),
    brand: buildEmailBrand(org, config),
  };
}

/** The bare default `from` address (used by tests and as a last-resort fallback). */
export function getDefaultFromAddress(): string {
  return env.EMAIL_FROM_DEFAULT;
}
