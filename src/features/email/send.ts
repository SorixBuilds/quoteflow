import "server-only";

import type { EntityType } from "@prisma/client";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { getEmailContext } from "@/features/email/branding";
import { resolveEmailProvider } from "@/features/email/providers/resolve";
import type { EmailAttachment } from "@/features/email/providers/types";
import {
  renderTemplate,
  type EmailTemplateInput,
} from "@/features/email/templates";
import {
  createEmailLog,
  getEmailLogById,
  updateEmailLogStatus,
} from "@/features/email/repository";
import type { EmailStatus } from "@/features/email/validation";

/**
 * Email Service — `sendTemplatedEmail` (Phase 6B Step 5, §11.6, §11.8).
 *
 * The single funnel every outbound email passes through. Deliberately **not** a
 * `"use server"` action: §11.8 forbids a standalone client-callable "send
 * arbitrary email" surface, which would be a spam-relay vector. Instead this is
 * a `server-only` module function invoked exclusively from inside an
 * already-permission-checked server action (sendQuote, recordPayment, …) or its
 * dispatch helper. The `organizationId` it scopes to is always one the caller
 * already proved via `requireCompanyScope()` — never read from a request.
 *
 * Invariants (§11.7, §11.12):
 *  - Exactly **one** `EmailLog` row per attempt: QUEUED on entry, then a single
 *    terminal-status update — regardless of provider success/failure.
 *  - `from`/`reply-to` are derived server-side from `lib/config` (§11.9), never
 *    supplied by the caller.
 *  - Provider identity decides only SIMULATED (console) vs SENT (funded), §11.6.
 *  - Never throws: a delivery failure is recorded as a FAILED row and swallowed,
 *    so an email problem can never roll back the business action that triggered
 *    it (the calls are additive instrumentation, §11.8).
 */

const recipientSchema = z.string().trim().email();

export type SendTemplatedEmailInput = {
  organizationId: string;
  to: string;
  template: EmailTemplateInput;
  relatedEntityType?: EntityType;
  relatedEntityId?: string;
  attachments?: EmailAttachment[];
  /**
   * When set, re-enter the flow on an existing `EmailLog` row (a retry, §11.10)
   * instead of creating a new one — the attempt counter increments in place.
   */
  existingLogId?: string;
};

export type SentEmail = { id: string; status: EmailStatus };

export async function sendTemplatedEmail(
  input: SendTemplatedEmailInput,
): Promise<SentEmail | null> {
  const {
    organizationId,
    to,
    template,
    relatedEntityType,
    relatedEntityId,
    attachments,
    existingLogId,
  } = input;

  try {
    const provider = resolveEmailProvider();
    const context = await getEmailContext(organizationId);
    const { subject, html, text } = renderTemplate(template, context.brand);

    // One row per attempt: reuse the failed row on retry, else create QUEUED.
    const logId =
      existingLogId ??
      (
        await createEmailLog(organizationId, {
          toEmail: to,
          fromEmail: context.sender.fromEmail,
          subject,
          templateType: template.type,
          relatedEntityType,
          relatedEntityId,
          status: "QUEUED",
        })
      ).id;

    // Recipient validation (§10, §11.9) — an unsendable address is recorded as a
    // FAILED attempt rather than handed to the provider.
    if (!recipientSchema.safeParse(to).success) {
      await updateEmailLogStatus(organizationId, logId, {
        status: "FAILED",
        lastError: "Invalid recipient address",
        incrementAttempt: true,
      });
      return { id: logId, status: "FAILED" };
    }

    const result = await provider.send({
      to,
      from: context.sender.from,
      subject,
      html,
      text,
      replyTo: context.sender.replyTo,
      attachments,
    });

    const status: EmailStatus = result.success
      ? provider.name === "console"
        ? "SIMULATED"
        : "SENT"
      : "FAILED";

    await updateEmailLogStatus(organizationId, logId, {
      status,
      providerMessageId: result.providerMessageId ?? null,
      lastError: result.error ?? null,
      sentAt: result.success ? new Date() : null,
      incrementAttempt: true,
    });

    return { id: logId, status };
  } catch (error) {
    // Rendering/DB failure — never propagate into the business action.
    logger.error("sendTemplatedEmail failed", {
      templateType: template.type,
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Whether a FAILED log row is still eligible for retry (§11.10 — capped at 5). */
export async function getRetryableLog(organizationId: string, id: string) {
  const log = await getEmailLogById(organizationId, id);
  if (!log) return null;
  if (log.status !== "FAILED") return null;
  if (log.attempts >= 5) return null;
  return log;
}
