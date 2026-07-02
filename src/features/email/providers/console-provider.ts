import { logger } from "@/lib/logger";
import type {
  EmailMessage,
  EmailProvider,
  EmailSendResult,
} from "@/features/email/providers/types";

/**
 * The zero-cost default email adapter (Phase 6, §11.1, §11.6).
 *
 * Sends nothing. It logs the fully-rendered message to the structured server
 * log and reports success — preserving the frozen "Quote Sent = a status flip,
 * no email actually sent" posture while making every would-be-sent email
 * visible in `EmailLog` and stdout. Because it reports `success: true` with no
 * `providerMessageId`, the workflow layer (Step 4) records the message as
 * SIMULATED rather than SENT, so history is honest about what happened.
 *
 * `name` is "console"; nothing branches on it except that SIMULATED/SENT
 * distinction (§6.1 forbids feature code branching on provider identity).
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    logger.info("Email (simulated — ConsoleEmailProvider)", {
      to: message.to,
      from: message.from,
      replyTo: message.replyTo ?? undefined,
      subject: message.subject,
      // Body is logged at debug-volume detail intentionally: this is the only
      // place a developer can read what *would* have been delivered before
      // Resend is funded. No secret is interpolated into an email body.
      textPreview: message.text.slice(0, 500),
      // Attachments are logged by name/size only — never their bytes.
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        sizeBytes: a.content.length,
      })),
    });
    return { success: true };
  }
}
