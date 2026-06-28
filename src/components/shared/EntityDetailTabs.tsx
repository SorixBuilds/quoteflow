import type { ReactNode } from "react";
import Link from "next/link";
import type { EntityType } from "@prisma/client";

import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/features/activity/components/ActivityTimeline";
import { NotesList } from "@/features/notes/components/NotesList";
import { TaskList } from "@/features/tasks/components/TaskList";

/**
 * Entity detail tab shell (Phase 5, §12, §13). The identical Overview | Activity
 * | Notes | Tasks tab set across Lead/Quote/Job/Customer/Invoice detail pages.
 *
 * Tab selection is URL-driven (`?tab=`) so every panel stays a server component
 * (the Activity/Notes/Tasks panels are async server components, keyed only by
 * `entityType`/`entityId`) — no client tab state, shareable links, and zero
 * per-module custom work.
 */

export type DetailTab = "overview" | "activity" | "notes" | "tasks";

const TABS: { key: DetailTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "activity", label: "Activity" },
  { key: "notes", label: "Notes" },
  { key: "tasks", label: "Tasks" },
];

export function parseDetailTab(value: string | undefined): DetailTab {
  return value === "activity" || value === "notes" || value === "tasks"
    ? value
    : "overview";
}

export function EntityDetailTabs({
  entityType,
  entityId,
  basePath,
  tab,
  overview,
}: {
  entityType: EntityType;
  entityId: string;
  /** Detail route path used to build tab links, e.g. `/leads/abc`. */
  basePath: string;
  tab: DetailTab;
  overview: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b" aria-label="Detail sections">
        {TABS.map(({ key, label }) => {
          const href = key === "overview" ? basePath : `${basePath}?tab=${key}`;
          const active = tab === key;
          return (
            <Link
              key={key}
              href={href}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div>
        {tab === "overview" ? overview : null}
        {tab === "activity" ? (
          <ActivityTimeline entityType={entityType} entityId={entityId} />
        ) : null}
        {tab === "notes" ? (
          <NotesList entityType={entityType} entityId={entityId} />
        ) : null}
        {tab === "tasks" ? (
          <TaskList entityType={entityType} entityId={entityId} />
        ) : null}
      </div>
    </div>
  );
}
