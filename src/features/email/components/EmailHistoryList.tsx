import type { EntityType } from "@prisma/client";
import { Mail } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { listEmailHistoryForEntity } from "@/features/email/queries";
import {
  EMAIL_STATUS_COLORS,
  EMAIL_STATUS_LABELS,
  emailTemplateLabel,
} from "@/features/email/labels";
import { ResendEmailButton } from "@/features/email/components/ResendEmailButton";

/**
 * Email history panel (§11.5, §13). Embedded by every entity detail view's Email
 * tab — the read-only record of what was emailed for this Quote/Invoice/Job,
 * with delivery status and a Resend control on the failures that can be
 * re-attempted. Server component: the read is org-scoped in `queries.ts`.
 */
export async function EmailHistoryList({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const rows = await listEmailHistoryForEntity(entityType, entityId);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No emails yet"
        description="Emails sent for this record — quotes, invoices, receipts and updates — will appear here."
      />
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-foreground text-sm font-medium">
                {emailTemplateLabel(row.templateType)}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  EMAIL_STATUS_COLORS[row.status],
                )}
              >
                {EMAIL_STATUS_LABELS[row.status]}
              </span>
            </div>
            <p className="text-muted-foreground mt-0.5 truncate text-sm">
              {row.subject}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              To {row.toEmail} · {new Date(row.createdAt).toLocaleString()}
              {row.attempts > 1 ? ` · ${row.attempts} attempts` : ""}
            </p>
            {row.lastError ? (
              <p className="mt-1 text-xs text-red-600">{row.lastError}</p>
            ) : null}
          </div>
          {row.canRetry ? <ResendEmailButton emailLogId={row.id} /> : null}
        </li>
      ))}
    </ul>
  );
}
