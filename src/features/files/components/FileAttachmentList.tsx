import type { EntityType } from "@prisma/client";
import { Paperclip } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { requireSession } from "@/features/auth/queries";
import { getAttachmentsForEntity, type AttachmentView } from "@/features/files/queries";
import { canManageAttachmentTarget } from "@/features/files/access";
import { attachFile, removeAttachment, renameAttachment } from "@/features/files/actions";
import { AttachFileForm } from "@/features/files/components/AttachFileForm";
import { AttachmentRow } from "@/features/files/components/AttachmentRow";
import { FILE_CATEGORIES } from "@/features/files/validation";

/**
 * Polymorphic file-attachment panel (§14.5). Embedded by every entity detail
 * view's Files tab:
 *
 *   <FileAttachmentList entityType="JOB" entityId={job.id} />
 *
 * Server component: scopes the read to the caller's org and resolves whether the
 * caller may manage files on this parent (§14.8) — the add form and per-row
 * rename/remove controls render only when they may. Attachments are grouped by
 * category, newest first within each group (§14.5).
 */

export function AttachmentListView({
  attachments,
  canManage,
}: {
  attachments: AttachmentView[];
  canManage: boolean;
}) {
  if (attachments.length === 0) {
    return (
      <EmptyState
        icon={Paperclip}
        title="No files yet"
        description={
          canManage
            ? "Attach a photo or document for this record above."
            : "No files have been attached to this record."
        }
      />
    );
  }

  // Stable category grouping in the documented order; unknown categories last.
  const order = new Map(FILE_CATEGORIES.map((c, i) => [c as string, i]));
  const groups = new Map<string, AttachmentView[]>();
  for (const item of attachments) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  const sortedGroups = [...groups.entries()].sort(
    ([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99),
  );

  return (
    <div className="space-y-4">
      {sortedGroups.map(([category, items]) => (
        <div key={category}>
          <h4 className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wide uppercase">
            {category}
          </h4>
          <ul className="divide-y rounded-md border">
            {items.map((attachment) => (
              <AttachmentRow
                key={attachment.id}
                attachment={attachment}
                canManage={canManage}
                onRename={renameAttachment}
                onRemove={removeAttachment}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export async function FileAttachmentList({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const session = await requireSession();
  const [attachments, canManage] = await Promise.all([
    getAttachmentsForEntity(session.organizationId, entityType, entityId),
    canManageAttachmentTarget(
      { organizationId: session.organizationId, role: session.role, userId: session.id },
      entityType,
      entityId,
    ),
  ]);

  return (
    <div className="space-y-4">
      {canManage ? (
        <AttachFileForm entityType={entityType} entityId={entityId} action={attachFile} />
      ) : null}
      <AttachmentListView attachments={attachments} canManage={canManage} />
    </div>
  );
}
