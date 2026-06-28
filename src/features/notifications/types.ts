/**
 * Notification shapes shared between server (queries) and client (UI) for
 * Phase 4 (§15). The DB model is richer; this is the safe projection the UI
 * renders.
 */
export type NotificationPriority = "LOW" | "NORMAL" | "HIGH";

export type NotificationView = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  priority: string;
  actionUrl: string | null;
  actionLabel: string | null;
  isRead: boolean;
  createdAt: Date;
};
