import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailProvider } from "@/features/email/providers/types";

const { repo } = vi.hoisted(() => ({
  repo: {
    createEmailLog: vi.fn(),
    updateEmailLogStatus: vi.fn(),
    getEmailLogById: vi.fn(),
  },
}));
vi.mock("@/features/email/repository", () => repo);
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/email/branding", () => ({
  getEmailContext: vi.fn().mockResolvedValue({
    organizationId: "org-1",
    sender: { from: "Acme Co <hi@acme.test>", fromEmail: "hi@acme.test", replyTo: null },
    brand: {
      companyName: "Acme Co",
      logoUrl: null,
      primaryColor: "#16243B",
      accentColor: "#F2994A",
      footer: "",
      signature: "",
      appUrl: "https://app.test",
    },
  }),
}));

import { providerRegistry } from "@/lib/providers/registry";
import { EMAIL_TEMPLATES, type EmailTemplateInput } from "@/features/email/templates";
import { sendTemplatedEmail } from "@/features/email/send";

/**
 * Email Service invariants (§11.6, §11.7, §11.12). Exactly one EmailLog row per
 * attempt; provider identity decides SIMULATED vs SENT; failures and invalid
 * recipients are recorded, not thrown; the org passed by the (already-authed)
 * caller scopes every write.
 */
const TEMPLATE: EmailTemplateInput = {
  type: EMAIL_TEMPLATES.quoteShared,
  data: { customerName: "Jo", quoteNumber: "Q-1", total: "$10.00", expiryLabel: null, viewUrl: null },
};

function override(provider: EmailProvider) {
  providerRegistry.override<EmailProvider>("email", () => provider);
}

beforeEach(() => {
  repo.createEmailLog.mockResolvedValue({ id: "log-1" });
  repo.updateEmailLogStatus.mockResolvedValue({ count: 1 });
});
afterEach(() => {
  providerRegistry.reset();
  vi.clearAllMocks();
});

describe("sendTemplatedEmail — one row per attempt (§11.12)", () => {
  it("writes exactly one EmailLog row: QUEUED create, then one terminal update", async () => {
    override({ name: "console", send: async () => ({ success: true }) });
    await sendTemplatedEmail({
      organizationId: "org-1",
      to: "c@acme.test",
      template: TEMPLATE,
      relatedEntityType: "QUOTE",
      relatedEntityId: "11111111-1111-4111-8111-111111111111",
    });
    expect(repo.createEmailLog).toHaveBeenCalledOnce();
    expect(repo.updateEmailLogStatus).toHaveBeenCalledOnce();

    const [orgArg, createInput] = repo.createEmailLog.mock.calls[0];
    expect(orgArg).toBe("org-1"); // org isolation — caller-supplied scope
    expect(createInput.status).toBe("QUEUED");
    expect(createInput.fromEmail).toBe("hi@acme.test");
    expect(createInput.templateType).toBe("quote_shared");
  });
});

describe("provider identity → status (§11.6)", () => {
  it("records SIMULATED under the console provider", async () => {
    override({ name: "console", send: async () => ({ success: true }) });
    const result = await sendTemplatedEmail({ organizationId: "org-1", to: "c@acme.test", template: TEMPLATE });
    expect(result?.status).toBe("SIMULATED");
  });

  it("records SENT under a funded provider", async () => {
    override({ name: "resend", send: async () => ({ success: true, providerMessageId: "m1" }) });
    const result = await sendTemplatedEmail({ organizationId: "org-1", to: "c@acme.test", template: TEMPLATE });
    expect(result?.status).toBe("SENT");
    const [, , update] = repo.updateEmailLogStatus.mock.calls[0];
    expect(update.providerMessageId).toBe("m1");
    expect(update.sentAt).toBeInstanceOf(Date);
  });

  it("records FAILED when the provider reports failure", async () => {
    override({ name: "resend", send: async () => ({ success: false, error: "bounce" }) });
    const result = await sendTemplatedEmail({ organizationId: "org-1", to: "c@acme.test", template: TEMPLATE });
    expect(result?.status).toBe("FAILED");
    const [, , update] = repo.updateEmailLogStatus.mock.calls[0];
    expect(update.lastError).toBe("bounce");
    expect(update.sentAt).toBeNull();
  });
});

describe("recipient validation (§11.9)", () => {
  it("records FAILED and never calls the provider for an invalid address", async () => {
    const send = vi.fn();
    override({ name: "console", send });
    const result = await sendTemplatedEmail({ organizationId: "org-1", to: "not-an-email", template: TEMPLATE });
    expect(result?.status).toBe("FAILED");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("retry re-enters the same row (§11.10)", () => {
  it("does not create a new row when existingLogId is supplied", async () => {
    override({ name: "console", send: async () => ({ success: true }) });
    await sendTemplatedEmail({
      organizationId: "org-1",
      to: "c@acme.test",
      template: TEMPLATE,
      existingLogId: "log-existing",
    });
    expect(repo.createEmailLog).not.toHaveBeenCalled();
    const [, id] = repo.updateEmailLogStatus.mock.calls[0];
    expect(id).toBe("log-existing");
  });
});

describe("provider-swap produces identical EmailLog shape (§11.12)", () => {
  it("console vs funded differ only in status/providerMessageId", async () => {
    override({ name: "console", send: async () => ({ success: true }) });
    await sendTemplatedEmail({ organizationId: "org-1", to: "c@acme.test", template: TEMPLATE });
    const consoleCreate = repo.createEmailLog.mock.calls[0][1];

    vi.clearAllMocks();
    repo.createEmailLog.mockResolvedValue({ id: "log-2" });
    repo.updateEmailLogStatus.mockResolvedValue({ count: 1 });
    override({ name: "resend", send: async () => ({ success: true, providerMessageId: "m1" }) });
    await sendTemplatedEmail({ organizationId: "org-1", to: "c@acme.test", template: TEMPLATE });
    const resendCreate = repo.createEmailLog.mock.calls[0][1];

    // The QUEUED row written is identical regardless of which provider is active.
    expect(consoleCreate).toEqual(resendCreate);
  });

  it("never throws when the provider/render path errors", async () => {
    override({
      name: "resend",
      send: async () => {
        throw new Error("kaboom");
      },
    });
    // Provider throwing inside send is caught by the provider contract normally,
    // but even an unexpected throw must not propagate out of the service.
    const result = await sendTemplatedEmail({ organizationId: "org-1", to: "c@acme.test", template: TEMPLATE });
    expect(result).toBeNull();
  });
});
