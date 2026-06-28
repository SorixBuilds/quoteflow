"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

import { cn } from "@/lib/utils";
import { markAllRead, markRead } from "@/features/notifications/actions";
import { NotificationCenter } from "@/features/notifications/components/NotificationCenter";
import {
  useInvalidateNotifications,
  useNotifications,
} from "@/features/notifications/useNotifications";
import type { NotificationView } from "@/features/notifications/types";

/**
 * Notification bell + center (Phase 4, §15, §21). The list is kept fresh by the
 * TanStack Query notification poll (30s staleness, refetch on focus); mutations
 * invalidate that query for an immediate refresh.
 */
export function NotificationBell({
  initialNotifications,
}: {
  initialNotifications: NotificationView[];
}) {
  const router = useRouter();
  const { data: notifications } = useNotifications(initialNotifications);
  const invalidate = useInvalidateNotifications();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function handleMarkAllRead() {
    startTransition(async () => {
      await markAllRead();
      await invalidate();
    });
  }

  function handleItemClick(notification: NotificationView) {
    startTransition(async () => {
      if (!notification.isRead) await markRead(notification.id);
      await invalidate();
      if (notification.actionUrl) {
        setOpen(false);
        router.push(notification.actionUrl);
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="hover:bg-accent relative flex size-9 items-center justify-center rounded-md transition-colors"
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span
            className={cn(
              "bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
            )}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="bg-popover text-popover-foreground absolute right-0 z-50 mt-2 rounded-md border shadow-md">
          <NotificationCenter
            notifications={notifications}
            onMarkAllRead={handleMarkAllRead}
            onItemClick={handleItemClick}
            disabled={isPending}
          />
        </div>
      ) : null}
    </div>
  );
}
