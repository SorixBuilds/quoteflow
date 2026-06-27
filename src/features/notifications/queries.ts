import { db } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import type { NotificationView } from "@/features/notifications/types";

/**
 * Notification read path (Phase 4, §15). Always scoped to the current user
 * within their organization — a user only ever sees their own notifications.
 */

const VIEW_SELECT = {
  id: true,
  type: true,
  title: true,
  body: true,
  priority: true,
  actionUrl: true,
  actionLabel: true,
  isRead: true,
  createdAt: true,
} as const;

/** Unread notifications for the current user (drives the bell's unread count). */
export async function getUnreadNotifications(): Promise<NotificationView[]> {
  const session = await requireSession();
  return db.notification.findMany({
    where: {
      organizationId: session.organizationId,
      userId: session.id,
      isRead: false,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: VIEW_SELECT,
  });
}

/** Recent notifications (read + unread) for the notification center list. */
export async function getRecentNotifications(
  limit = 20,
): Promise<NotificationView[]> {
  const session = await requireSession();
  return db.notification.findMany({
    where: { organizationId: session.organizationId, userId: session.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: VIEW_SELECT,
  });
}
