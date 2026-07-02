import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/permissions", () => ({
  requireRole: vi.fn(),
  requireCompanyScope: vi.fn(),
  requireActiveUser: vi.fn(),
}));
vi.mock("@/features/activity/actions", () => ({ logActivity: vi.fn() }));

const { send, dispatch, branding } = vi.hoisted(() => ({
  send: { getRetryableLog: vi.fn(), sendTemplatedEmail: vi.fn() },
  dispatch: { rebuildEmailJob: vi.fn() },
  branding: { getEmailContext: vi.fn() },
}));
vi.mock("@/features/email/send", () => send);
vi.mock("@/features/email/dispatch", () => dispatch);
vi.mock("@/features/email/branding", () => branding);

import { requireRole, requireCompanyScope } from "@/lib/permissions";
import { EMAIL_TEMPLATES } from "@/features/email/templates";
import { previewEmailTemplate, retryEmail } from "@/features/email/actions";

/**
 * Email admin actions (§11.8, §11.10, §13). Retry is OWNER/STAFF-gated, only acts
 * on a still-eligible FAILED row, and re-enters the same EmailLog row. Preview is
 * read-only. There is deliberately NO arbitrary-send action (§11.8).
 */
const staff = { id: "u1", organizationId: "org-1", role: "STAFF" as const, name: "Dana", email: "d@a.test" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue(staff);
  vi.mocked(requireCompanyScope).mockResolvedValue({ organizationId: "org-1" });
});

describe("retryEmail (§11.10)", () => {
  it("rejects a row that is not retry-eligible", async () => {
    send.getRetryableLog.mockResolvedValue(null);
    const result = await retryEmail("log-1");
    expect(result.success).toBe(false);
    expect(send.sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("re-derives and re-sends on the same row when eligible", async () => {
    send.getRetryableLog.mockResolvedValue({
      id: "log-1",
      templateType: EMAIL_TEMPLATES.quoteShared,
      relatedEntityType: "QUOTE",
      relatedEntityId: "q1",
    });
    dispatch.rebuildEmailJob.mockResolvedValue({
      to: "jo@acme.test",
      template: { type: EMAIL_TEMPLATES.quoteShared, data: {} },
      relatedEntityType: "QUOTE",
      relatedEntityId: "q1",
    });
    send.sendTemplatedEmail.mockResolvedValue({ id: "log-1", status: "SIMULATED" });

    const result = await retryEmail("log-1");
    expect(result.success).toBe(true);
    expect(send.sendTemplatedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ existingLogId: "log-1", organizationId: "org-1" }),
    );
  });

  it("rejects when the template cannot be auto-rebuilt", async () => {
    send.getRetryableLog.mockResolvedValue({
      id: "log-1",
      templateType: EMAIL_TEMPLATES.portalInvitation,
      relatedEntityType: "CUSTOMER",
      relatedEntityId: "c1",
    });
    dispatch.rebuildEmailJob.mockResolvedValue(null);
    const result = await retryEmail("log-1");
    expect(result.success).toBe(false);
    expect(send.sendTemplatedEmail).not.toHaveBeenCalled();
  });
});

describe("previewEmailTemplate (§13)", () => {
  it("renders a template to subject + html with the tenant brand", async () => {
    branding.getEmailContext.mockResolvedValue({
      organizationId: "org-1",
      sender: { from: "x", fromEmail: "x@a.test", replyTo: null },
      brand: {
        companyName: "Acme Co",
        logoUrl: null,
        primaryColor: "#16243B",
        accentColor: "#F2994A",
        footer: "",
        signature: "",
        appUrl: "https://app.test",
      },
    });
    const result = await previewEmailTemplate({
      type: EMAIL_TEMPLATES.quoteShared,
      data: { customerName: "Jo", quoteNumber: "Q-1", total: "$10.00", expiryLabel: null, viewUrl: null },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subject).toContain("Q-1");
      expect(result.data.html).toContain("Acme Co");
    }
  });
});
