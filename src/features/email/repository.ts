import type { EmailLog, EntityType, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import type { CreateEmailLogInput, EmailStatus } from "@/features/email/validation";

/**
 * EmailLog repository (§7.2.1) — the data-access surface later milestones consume
 * for "was this email attempted, and what happened." Pure persistence: every
 * function is organization-scoped via an `organizationId` argument the caller
 * obtains from `requireCompanyScope()` (the repository never calls auth itself,
 * mirroring `features/notes/queries.ts`). No business workflow, no UI.
 *
 * The `sendTemplatedEmail()` flow (§11.6, a later step) writes exactly one row
 * here per attempt — `QUEUED` first, then a single terminal-status update — so a
 * retry re-enters from the row, not the original event.
 */

/** Record an attempted/queued send. Defaults to `QUEUED` per the schema. */
export function createEmailLog(
  organizationId: string,
  input: CreateEmailLogInput,
): Promise<EmailLog> {
  return db.emailLog.create({
    data: {
      organizationId,
      toEmail: input.toEmail,
      fromEmail: input.fromEmail,
      subject: input.subject,
      templateType: input.templateType,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      status: input.status ?? "QUEUED",
      providerMessageId: input.providerMessageId,
    },
  });
}

/** Fields a provider result updates on an existing row (terminal transition). */
export type EmailLogStatusUpdate = {
  status: EmailStatus;
  providerMessageId?: string | null;
  lastError?: string | null;
  sentAt?: Date | null;
  /** When set, increments the attempt counter. */
  incrementAttempt?: boolean;
};

/** Apply a provider outcome to an existing log row, org-scoped. */
export function updateEmailLogStatus(
  organizationId: string,
  id: string,
  update: EmailLogStatusUpdate,
): Promise<Prisma.BatchPayload> {
  return db.emailLog.updateMany({
    where: { id, organizationId },
    data: {
      status: update.status,
      providerMessageId: update.providerMessageId,
      lastError: update.lastError,
      sentAt: update.sentAt,
      attempts: update.incrementAttempt ? { increment: 1 } : undefined,
    },
  });
}

/** A single log row, org-scoped. */
export function getEmailLogById(
  organizationId: string,
  id: string,
): Promise<EmailLog | null> {
  return db.emailLog.findFirst({ where: { id, organizationId } });
}

/** Email history for one entity detail page (§11.9), newest first. */
export function listEmailLogsForEntity(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
): Promise<EmailLog[]> {
  return db.emailLog.findMany({
    where: { organizationId, relatedEntityType: entityType, relatedEntityId: entityId },
    orderBy: { createdAt: "desc" },
  });
}

/** Org-wide recent log rows, optionally filtered by status (e.g. retry sweep). */
export function listEmailLogs(
  organizationId: string,
  options: { status?: EmailStatus; take?: number } = {},
): Promise<EmailLog[]> {
  return db.emailLog.findMany({
    where: { organizationId, status: options.status },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 100,
  });
}
