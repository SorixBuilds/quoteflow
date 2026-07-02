import "server-only";

import type { EntityType } from "@prisma/client";

import { requireRole, requireCompanyScope } from "@/lib/permissions";
import { listEmailLogsForEntity } from "@/features/email/repository";
import { isRetryableTemplate } from "@/features/email/dispatch";
import type { EmailStatus } from "@/features/email/validation";

/**
 * Email history read path (Phase 6B Step 5, §11.5). The auth-scoped surface the
 * `EmailHistoryList` tab consumes — it resolves the caller's org from the staff
 * session (never the URL) and returns a serializable, hash-free view. Whether a
 * row's Retry control should render is computed here (FAILED + under the attempt
 * cap + an entity-derivable template), so the component stays presentational.
 */

export type EmailLogView = {
  id: string;
  toEmail: string;
  subject: string;
  templateType: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  /** True when a FAILED row is still eligible for the Retry button (§11.10). */
  canRetry: boolean;
};

export async function listEmailHistoryForEntity(
  entityType: EntityType,
  entityId: string,
): Promise<EmailLogView[]> {
  const session = await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope(session);

  const rows = await listEmailLogsForEntity(organizationId, entityType, entityId);
  return rows.map((row) => ({
    id: row.id,
    toEmail: row.toEmail,
    subject: row.subject,
    templateType: row.templateType,
    status: row.status as EmailStatus,
    attempts: row.attempts,
    lastError: row.lastError,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    canRetry:
      row.status === "FAILED" && row.attempts < 5 && isRetryableTemplate(row.templateType),
  }));
}
