import { logger } from "@/lib/logger";
import type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from "@/features/email/providers/types";

/**
 * Production email adapter — Resend (Phase 6B Step 5, §1, §11.13).
 *
 * The funded delivery path. It talks to the Resend REST API directly with the
 * built-in `fetch`, so adopting real email adds **no `resend` SDK dependency**
 * to the bundle — honoring §1's "no business module may directly depend on a
 * third-party email SDK" literally: there is no SDK, only an HTTP call behind
 * the same `EmailProvider` interface the console adapter implements. Swapping
 * from simulated to real delivery is therefore `EMAIL_PROVIDER=resend` +
 * `RESEND_API_KEY`, with zero change to any template, service, or call site
 * (§11.13).
 *
 * `name` is "resend" — the workflow layer reads it only to record SENT (real)
 * rather than SIMULATED (console); nothing else branches on provider identity
 * (§6.1).
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";

  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          ...(message.attachments && message.attachments.length > 0
            ? {
                attachments: message.attachments.map((a) => ({
                  filename: a.filename,
                  content: a.content.toString("base64"),
                  content_type: a.contentType,
                })),
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const detail = await safeErrorDetail(response);
        return {
          success: false,
          error: `Resend responded ${response.status}: ${detail}`,
        };
      }

      const payload = (await response.json().catch(() => null)) as
        | { id?: string }
        | null;
      return { success: true, providerMessageId: payload?.id };
    } catch (error) {
      // Network/transport failure — surfaced as a FAILED EmailLog row by the
      // workflow layer, eligible for retry. Never throws into the caller.
      logger.error("ResendEmailProvider.send transport error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Email transport error",
      };
    }
  }
}

/** Best-effort extraction of an error message from a non-2xx Resend response. */
async function safeErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string } | null;
    return body?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
