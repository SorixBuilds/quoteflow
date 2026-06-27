"use client";

import { BellOff } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import type { NotificationView } from "@/features/notifications/types";

/**
 * Notification center panel (Phase 4, §15) — presentational. Lists recent
 * notifications with read/unread styling, a "mark all read" bulk action, and a
 * per-row click that the parent maps to `markRead` + optional `actionUrl`
 * navigation.
 */
export function NotificationCenter({
  notifications,
  onMarkAllRead,
  onItemClick,
  disabled,
}: {
  notifications: NotificationView[];
  onMarkAllRead: () => void;
  onItemClick: (notification: NotificationView) => void;
  disabled?: boolean;
}) {
  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <div className="w-80">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <span className="text-sm font-semibold">Notifications</span>
        <button
          type="button"
          onClick={onMarkAllRead}
          disabled={disabled || !hasUnread}
          className="text-primary text-xs font-medium disabled:opacity-40"
        >
          Mark all read
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={BellOff}
            title="You're all caught up"
            description="New notifications will show up here."
          />
        </div>
      ) : (
        <ul className="max-h-96 overflow-y-auto">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onItemClick(n)}
                disabled={disabled}
                className={cn(
                  "hover:bg-accent flex w-full flex-col items-start gap-0.5 border-b px-4 py-3 text-left transition-colors",
                  !n.isRead && "bg-accent/40",
                )}
              >
                <div className="flex w-full items-center gap-2">
                  {!n.isRead ? (
                    <span
                      aria-label="Unread"
                      className="bg-primary size-2 shrink-0 rounded-full"
                    />
                  ) : null}
                  <span className="text-foreground text-sm font-medium">
                    {n.title}
                  </span>
                </div>
                {n.body ? (
                  <span className="text-muted-foreground text-xs">{n.body}</span>
                ) : null}
                {n.actionLabel ? (
                  <span className="text-primary text-xs font-medium">
                    {n.actionLabel}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
