"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type EntityType } from "@prisma/client";

import { db } from "@/lib/db";
import { requireSession } from "@/lib/permissions";
import { getRecentNotifications } from "@/features/notifications/queries";
import type { ActionResult } from "@/types";
import type {
  NotificationPriority,
  NotificationView,
} from "@/features/notifications/types";

/**
 * Notification write path (Phase 4, §15). `createNotification` is the producer
 * contract every module calls; `markRead`/`markAllRead` are the consumer
 * lifecycle actions invoked from the notification center. All are company- and
 * user-scoped: a caller can only create within their own org and only mark their
 * own notifications read.
 *
 * The email/SMS delivery adapter (§3.5) attaches here later — `createNotification`
 * writes the row today and will additionally call Resend/SMS with zero change to
 * any producer.
 */

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  priority?: NotificationPriority;
  entityType?: EntityType;
  entityId?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
};

export async function createNotification(
  input: CreateNotificationInput,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();
  const created = await db.notification.create({
    data: {
      organizationId: session.organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      priority: input.priority ?? "NORMAL",
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      actionUrl: input.actionUrl ?? null,
      actionLabel: input.actionLabel ?? null,
      metadata: input.metadata
        ? (input.metadata as Prisma.InputJsonObject)
        : undefined,
    },
    select: { id: true },
  });
  return { success: true, data: { id: created.id } };
}

export async function markRead(
  notificationId: string,
): Promise<ActionResult<null>> {
  const session = await requireSession();
  // Scoped to the caller: a user can only mark their own notifications.
  await db.notification.updateMany({
    where: { id: notificationId, userId: session.id },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { success: true, data: null };
}

/** Client-callable fetch for the TanStack Query notification poll (§21). */
export async function fetchRecentNotificationsAction(): Promise<
  NotificationView[]
> {
  return getRecentNotifications();
}

export async function markAllRead(): Promise<ActionResult<{ updated: number }>> {
  const session = await requireSession();
  const result = await db.notification.updateMany({
    where: { userId: session.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath("/", "layout");
  return { success: true, data: { updated: result.count } };
}
