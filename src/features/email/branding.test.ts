import { describe, expect, it } from "vitest";

import { buildEmailBrand, buildEmailSender } from "@/features/email/branding";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";
import type { CompanyConfig } from "@/lib/config/schema";

/**
 * Sender identity & branding derivation (§9, §11.9). The `from` is built only
 * from the org row + config — never a client value — and is hardened against
 * header injection. Pure functions: no DB, no env mutation.
 */
function configWith(email: Partial<CompanyConfig["email"]>): CompanyConfig {
  return {
    ...DEFAULT_COMPANY_CONFIG,
    email: { ...DEFAULT_COMPANY_CONFIG.email, ...email },
  };
}

describe("buildEmailSender (§11.9)", () => {
  it("falls back to the platform default address and org name when unset", () => {
    const sender = buildEmailSender("Acme Co", configWith({}));
    expect(sender.fromEmail).toBe("no-reply@quoteflow.app");
    expect(sender.from).toBe("Acme Co <no-reply@quoteflow.app>");
    expect(sender.replyTo).toBeNull();
  });

  it("uses the tenant's configured sender + reply-to when present", () => {
    const sender = buildEmailSender(
      "Acme Co",
      configWith({ senderName: "Acme Billing", senderEmail: "hi@acme.test", replyTo: "reply@acme.test" }),
    );
    expect(sender.fromEmail).toBe("hi@acme.test");
    expect(sender.from).toBe("Acme Billing <hi@acme.test>");
    expect(sender.replyTo).toBe("reply@acme.test");
  });

  it("strips CR/LF from the display name (header-injection guard)", () => {
    const sender = buildEmailSender(
      "Acme\r\nBcc: evil@example.com",
      configWith({ senderEmail: "hi@acme.test" }),
    );
    expect(sender.from).not.toContain("\n");
    expect(sender.from).not.toContain("\r");
  });

  it("quotes a display name containing RFC 5322 specials", () => {
    const sender = buildEmailSender("Acme, Inc.", configWith({ senderEmail: "hi@acme.test" }));
    expect(sender.from).toBe('"Acme, Inc." <hi@acme.test>');
  });
});

describe("buildEmailBrand", () => {
  it("derives brand bundle from org + config", () => {
    const brand = buildEmailBrand(
      { name: "Acme Co", logoUrl: "https://cdn.test/logo.png" },
      configWith({ footer: "123 Main St", signature: "— The Acme Team" }),
    );
    expect(brand.companyName).toBe("Acme Co");
    expect(brand.logoUrl).toBe("https://cdn.test/logo.png");
    expect(brand.primaryColor).toBe(DEFAULT_COMPANY_CONFIG.branding.primaryColor);
    expect(brand.footer).toBe("123 Main St");
    expect(brand.signature).toBe("— The Acme Team");
  });
});
