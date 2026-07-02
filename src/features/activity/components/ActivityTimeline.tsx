import type { EntityType } from "@prisma/client";
import { History } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { requireSession } from "@/features/auth/queries";
import {
  getActivityForEntity,
  type ActivityEntry,
} from "@/features/activity/queries";

/**
 * Polymorphic activity timeline (Phase 4, §14). Built once, embedded unmodified
 * by every entity detail view in Phase 5+:
 *
 *   <ActivityTimeline entityType="LEAD" entityId={lead.id} />
 *
 * The async server component scopes the read to the caller's organization; the
 * presentational `ActivityTimelineView` is what tests render directly.
 */

/** Human-readable labels for known event types; unknown types are humanized. */
const TYPE_LABELS: Record<string, string> = {
  created: "Created",
  status_changed: "Status changed",
  assigned: "Assigned",
  note_added: "Note added",
  quote_sent: "Quote sent",
  quote_viewed: "Quote viewed",
  quote_accepted: "Quote accepted",
  quote_declined: "Quote declined",
  job_scheduled: "Job scheduled",
  job_completed: "Job completed",
  settings_updated: "Settings updated",
  file_attached: "File attached",
  file_renamed: "File renamed",
  file_removed: "File removed",
};

function labelForType(type: string): string {
  return (
    TYPE_LABELS[type] ??
    type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export function ActivityTimelineView({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Actions on this record will appear here."
      />
    );
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <div className="bg-border mt-1.5 size-2 shrink-0 rounded-full" />
          <div className="min-w-0">
            <p className="text-foreground text-sm font-medium">
              {labelForType(entry.type)}
            </p>
            {entry.message ? (
              <p className="text-muted-foreground text-sm">{entry.message}</p>
            ) : null}
            <p className="text-muted-foreground mt-0.5 text-xs">
              {entry.actorName} · {entry.createdAt.toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export async function ActivityTimeline({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const session = await requireSession();
  const entries = await getActivityForEntity(
    session.organizationId,
    entityType,
    entityId,
  );
  return <ActivityTimelineView entries={entries} />;
}
