import type { Provider } from "@/lib/providers/types";

/**
 * Email provider contract (Phase 6, §11.6).
 *
 * The single interface every email-triggering event ultimately calls. Phase 6A
 * ships the interface, the zero-cost default (`ConsoleEmailProvider`), and the
 * resolver; the templating + `EmailLog` write that wrap it (`sendTemplatedEmail`)
 * are the Email *workflow*, deferred to Step 4 (§29). A funded `ResendEmailProvider`
 * is one new file implementing this interface plus `EMAIL_PROVIDER=resend`
 * (§11.13) — no change to any caller.
 */

/**
 * A binary attachment (e.g. a Quote/Invoice/Receipt PDF rendered by the Document
 * Engine, §10). Provider-agnostic: the console adapter logs its presence, a
 * funded adapter base64-encodes `content` into its API payload. Kept optional on
 * {@link EmailMessage} so every existing call site is unaffected (§11.13).
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

/** A fully-rendered message, provider-agnostic (templating happens upstream). */
export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  /** Optional reply-to header, derived server-side from `lib/config` (§11.9). */
  replyTo?: string | null;
  /** Optional binary attachments (rendered PDFs); never user-supplied files. */
  attachments?: EmailAttachment[];
}

/**
 * The result every provider returns. `success` drives the `EmailLog` terminal
 * status the workflow layer writes (Step 4); `providerMessageId` is null under
 * the console default and set by a funded provider.
 */
export interface EmailSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface EmailProvider extends Provider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
