"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchRecentNotificationsAction } from "@/features/notifications/actions";
import type { NotificationView } from "@/features/notifications/types";

/**
 * Client notification polling (Phase 4, §21). TanStack Query staleness policy
 * for notifications: 30s `staleTime`, refetch on the 30s interval and on window
 * focus. Seeded with the server-rendered list so there's no initial spinner.
 */
export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;
export const NOTIFICATIONS_STALE_MS = 30_000;

export function useNotifications(initialData: NotificationView[]) {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => fetchRecentNotificationsAction(),
    initialData,
    staleTime: NOTIFICATIONS_STALE_MS,
    refetchInterval: NOTIFICATIONS_STALE_MS,
    refetchOnWindowFocus: true,
  });
}

/** Invalidate the notifications query after a mutation (markRead/markAllRead). */
export function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
}
