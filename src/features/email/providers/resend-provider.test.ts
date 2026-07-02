import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResendEmailProvider } from "@/features/email/providers/resend-provider";
import type { EmailMessage } from "@/features/email/providers/types";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * Production adapter (§1, §11.13). Talks to the Resend REST API via `fetch` —
 * no SDK. These assert the request shape (auth header, recipient array, base64
 * attachments, reply-to) and the success/failure → result mapping that drives
 * the SENT/FAILED EmailLog status.
 */
const MESSAGE: EmailMessage = {
  to: "customer@example.com",
  from: "Acme Co <hi@acme.test>",
  subject: "Your quote",
  html: "<p>hi</p>",
  text: "hi",
  replyTo: "reply@acme.test",
  attachments: [
    { filename: "quote-Q-1.pdf", content: Buffer.from("PDFBYTES"), contentType: "application/pdf" },
  ],
};

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ResendEmailProvider (§11.13)", () => {
  it('identifies as "resend"', () => {
    expect(new ResendEmailProvider("key").name).toBe("resend");
  });

  it("posts an authorized request with base64 attachment + reply_to, returns the id", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: "msg_123" }),
    });

    const result = await new ResendEmailProvider("sk_test").send(MESSAGE);
    expect(result).toEqual({ success: true, providerMessageId: "msg_123" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer sk_test");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["customer@example.com"]);
    expect(body.reply_to).toBe("reply@acme.test");
    expect(body.attachments[0].content).toBe(Buffer.from("PDFBYTES").toString("base64"));
    expect(body.attachments[0].filename).toBe("quote-Q-1.pdf");
  });

  it("maps a non-2xx response to a FAILED result with detail", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable",
      json: async () => ({ message: "domain not verified" }),
    });
    const result = await new ResendEmailProvider("sk_test").send(MESSAGE);
    expect(result.success).toBe(false);
    expect(result.error).toContain("422");
    expect(result.error).toContain("domain not verified");
  });

  it("never throws on a transport error — returns a FAILED result", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    const result = await new ResendEmailProvider("sk_test").send(MESSAGE);
    expect(result.success).toBe(false);
    expect(result.error).toContain("ECONNRESET");
  });
});
