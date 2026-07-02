import { describe, expect, it } from "vitest";

import type { EmailBrand } from "@/features/email/branding";
import {
  EMAIL_TEMPLATES,
  buildTemplateBody,
  renderTemplate,
  type EmailTemplateInput,
} from "@/features/email/templates";
import { escapeHtml, safeUrl } from "@/features/email/templates/layout";

/**
 * Template rendering (§2, §3, §11.9, §11.12). Templates emit structured data;
 * the layout is the sole HTML producer and escapes every value. These tests
 * assert: correct interpolation, no unescaped user input, a plain-text
 * alternative, branding integration, and determinism.
 */

const BRAND: EmailBrand = {
  companyName: "Acme Co",
  logoUrl: "https://cdn.test/logo.png",
  primaryColor: "#16243B",
  accentColor: "#F2994A",
  footer: "123 Main St · (555) 010-0000",
  signature: "— The Acme Team",
  appUrl: "https://app.test",
};

const ALL_INPUTS: EmailTemplateInput[] = [
  { type: EMAIL_TEMPLATES.portalInvitation, data: { customerName: "Jo", portalUrl: "https://app.test/portal/login?token=x", expiresLabel: "Sep 1" } },
  { type: EMAIL_TEMPLATES.portalLogin, data: { customerName: "Jo", loginUrl: "https://app.test/portal/login?token=x", expiresLabel: "Sep 1" } },
  { type: EMAIL_TEMPLATES.quoteShared, data: { customerName: "Jo", quoteNumber: "Q-1", total: "$10.00", expiryLabel: "Sep 1", viewUrl: null } },
  { type: EMAIL_TEMPLATES.quoteAccepted, data: { customerName: "Jo", quoteNumber: "Q-1", total: "$10.00" } },
  { type: EMAIL_TEMPLATES.quoteDeclined, data: { customerName: "Jo", quoteNumber: "Q-1" } },
  { type: EMAIL_TEMPLATES.invoiceIssued, data: { customerName: "Jo", invoiceNumber: "INV-1", total: "$10.00", balance: "$10.00", dueLabel: "Sep 1", viewUrl: null } },
  { type: EMAIL_TEMPLATES.paymentReceived, data: { customerName: "Jo", invoiceNumber: "INV-1", amountPaid: "$5.00", balance: "$5.00" } },
  { type: EMAIL_TEMPLATES.jobScheduled, data: { customerName: "Jo", reference: "Q-1", scheduledLabel: "Sep 1", technician: "Sam" } },
  { type: EMAIL_TEMPLATES.jobCompleted, data: { customerName: "Jo", reference: "Q-1", notes: "All done" } },
  { type: EMAIL_TEMPLATES.generalNotification, data: { recipientName: "Jo", title: "Heads up", message: "Something happened", actionLabel: "Open", actionUrl: "https://app.test/x" } },
];

describe("escapeHtml / safeUrl (§11.9)", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>"&'`)).toBe("&lt;script&gt;&quot;&amp;&#39;");
  });

  it("neutralizes non-http(s)/mailto schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("https://ok.test/a")).toBe("https://ok.test/a");
    expect(safeUrl("mailto:a@b.test")).toBe("mailto:a@b.test");
  });
});

describe("renderTemplate — every template (§2)", () => {
  it.each(ALL_INPUTS.map((i) => [i.type, i] as const))(
    "%s produces subject, HTML and plain text",
    (_type, input) => {
      const { subject, html, text } = renderTemplate(input, BRAND);
      expect(subject.length).toBeGreaterThan(0);
      expect(html).toContain("<!doctype html>");
      expect(html).toContain("Acme Co"); // branding present
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain("<"); // plain-text carries no markup
    },
  );

  it("is deterministic (same input ⇒ identical output)", () => {
    const a = renderTemplate(ALL_INPUTS[2], BRAND);
    const b = renderTemplate(ALL_INPUTS[2], BRAND);
    expect(a).toEqual(b);
  });
});

describe("no unescaped user input reaches the HTML (§11.9)", () => {
  it("escapes a malicious customer name in the body", () => {
    const { html, text } = renderTemplate(
      {
        type: EMAIL_TEMPLATES.quoteShared,
        data: {
          customerName: '<script>alert("xss")</script>',
          quoteNumber: "Q-1",
          total: "$10.00",
          expiryLabel: null,
          viewUrl: null,
        },
      },
      BRAND,
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    // The plain-text part is not HTML and carries the raw name harmlessly.
    expect(text).toContain('<script>alert("xss")</script>');
  });
});

describe("branding integration (§2, §3)", () => {
  it("renders the logo, footer and signature when present", () => {
    const { html } = renderTemplate(ALL_INPUTS[2], BRAND);
    expect(html).toContain("https://cdn.test/logo.png");
    expect(html).toContain("123 Main St");
    expect(html).toContain("— The Acme Team");
  });

  it("falls back to the company name when there is no logo", () => {
    const { html } = renderTemplate(ALL_INPUTS[2], { ...BRAND, logoUrl: null });
    expect(html).not.toContain("<img");
    expect(html).toContain("Acme Co");
  });
});

describe("buildTemplateBody — content correctness", () => {
  it("quote_shared carries the number and total", () => {
    const body = buildTemplateBody(ALL_INPUTS[2], BRAND);
    expect(body.subject).toContain("Q-1");
    const flat = JSON.stringify(body.blocks);
    expect(flat).toContain("$10.00");
  });

  it("general_notification surfaces the CTA when an action is supplied", () => {
    const body = buildTemplateBody(ALL_INPUTS[9], BRAND);
    expect(body.cta).toEqual({ label: "Open", url: "https://app.test/x" });
  });
});
