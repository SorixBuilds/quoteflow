import { beforeEach, describe, expect, it, vi } from "vitest";

import { Decimal } from "@/lib/money";

const { db, renderDocument, sendTemplatedEmail } = vi.hoisted(() => ({
  db: {
    quote: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    job: { findFirst: vi.fn() },
  },
  renderDocument: vi.fn(),
  sendTemplatedEmail: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/config/service", () => ({
  getCompanyConfig: vi.fn().mockResolvedValue({ locale: { currency: "USD" } }),
}));
vi.mock("@/features/documents/render", () => ({ renderDocument }));
vi.mock("@/features/email/send", () => ({ sendTemplatedEmail }));

import {
  buildQuoteSharedEmail,
  buildPaymentReceivedEmail,
  isRetryableTemplate,
  notifyQuoteShared,
  rebuildEmailJob,
} from "@/features/email/dispatch";
import { EMAIL_TEMPLATES } from "@/features/email/templates";

/**
 * Dispatch helpers (§5–§7, §11.10). Builders load entity data, format money via
 * the shared `lib/money` (never re-implemented), attach the Document-Engine PDF,
 * and skip silently when there is no recipient. Retry re-derives from the entity.
 */
beforeEach(() => {
  vi.clearAllMocks();
  renderDocument.mockResolvedValue({ buffer: Buffer.from("PDF"), filename: "quote-Q-1.pdf" });
});

describe("buildQuoteSharedEmail (§5)", () => {
  it("returns a job with the Quote PDF attached and a formatted total", async () => {
    db.quote.findFirst.mockResolvedValue({
      quoteNumber: "Q-1",
      total: new Decimal("2450"),
      expiryDate: null,
      customer: { name: "Jo", email: "jo@acme.test" },
    });
    const job = await buildQuoteSharedEmail("org-1", "q1");
    expect(job).not.toBeNull();
    expect(job!.to).toBe("jo@acme.test");
    expect(job!.relatedEntityType).toBe("QUOTE");
    expect(job!.attachments?.[0].filename).toBe("quote-Q-1.pdf");
    expect(job!.attachments?.[0].contentType).toBe("application/pdf");
    expect(job!.template.type).toBe(EMAIL_TEMPLATES.quoteShared);
    if (job!.template.type === EMAIL_TEMPLATES.quoteShared) {
      expect(job!.template.data.total).toContain("2,450");
    }
  });

  it("returns null (no send) when the customer has no email", async () => {
    db.quote.findFirst.mockResolvedValue({
      quoteNumber: "Q-1",
      total: new Decimal("10"),
      expiryDate: null,
      customer: { name: "Jo", email: null },
    });
    expect(await buildQuoteSharedEmail("org-1", "q1")).toBeNull();
  });
});

describe("buildPaymentReceivedEmail (§6)", () => {
  it("computes the floored balance and attaches the receipt", async () => {
    db.invoice.findFirst.mockResolvedValue({
      invoiceNumber: "INV-1",
      amount: new Decimal("200"),
      paidAmount: new Decimal("50"),
      customer: { name: "Jo", email: "jo@acme.test" },
    });
    const job = await buildPaymentReceivedEmail("org-1", "inv1");
    expect(renderDocument).toHaveBeenCalledWith("receipt", "inv1", expect.objectContaining({ organizationId: "org-1" }));
    if (job!.template.type === EMAIL_TEMPLATES.paymentReceived) {
      expect(job!.template.data.balance).toContain("150");
      expect(job!.template.data.amountPaid).toContain("50");
    }
  });
});

describe("notify* wrappers", () => {
  it("forward the built job to sendTemplatedEmail", async () => {
    db.quote.findFirst.mockResolvedValue({
      quoteNumber: "Q-1",
      total: new Decimal("10"),
      expiryDate: null,
      customer: { name: "Jo", email: "jo@acme.test" },
    });
    await notifyQuoteShared("org-1", "q1");
    expect(sendTemplatedEmail).toHaveBeenCalledOnce();
    expect(sendTemplatedEmail.mock.calls[0][0]).toMatchObject({ organizationId: "org-1", to: "jo@acme.test" });
  });

  it("is a no-op when there is no recipient (never calls send)", async () => {
    db.quote.findFirst.mockResolvedValue({
      quoteNumber: "Q-1",
      total: new Decimal("10"),
      expiryDate: null,
      customer: { name: "Jo", email: null },
    });
    await notifyQuoteShared("org-1", "q1");
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });
});

describe("retry re-derivation (§11.10)", () => {
  it("maps a quote_shared log back to its builder", async () => {
    db.quote.findFirst.mockResolvedValue({
      quoteNumber: "Q-1",
      total: new Decimal("10"),
      expiryDate: null,
      customer: { name: "Jo", email: "jo@acme.test" },
    });
    const job = await rebuildEmailJob("org-1", {
      templateType: EMAIL_TEMPLATES.quoteShared,
      relatedEntityId: "q1",
    });
    expect(job?.template.type).toBe(EMAIL_TEMPLATES.quoteShared);
  });

  it("returns null for a token-bearing template that cannot be re-derived", async () => {
    const job = await rebuildEmailJob("org-1", {
      templateType: EMAIL_TEMPLATES.portalInvitation,
      relatedEntityId: "c1",
    });
    expect(job).toBeNull();
  });

  it("classifies which templates are retryable", () => {
    expect(isRetryableTemplate(EMAIL_TEMPLATES.invoiceIssued)).toBe(true);
    expect(isRetryableTemplate(EMAIL_TEMPLATES.portalInvitation)).toBe(false);
    expect(isRetryableTemplate(EMAIL_TEMPLATES.generalNotification)).toBe(false);
  });
});
