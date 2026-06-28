import type { ReactNode } from "react";

import { Sidebar } from "@/components/shared/Sidebar";
import { Topbar } from "@/components/shared/Topbar";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { getRecentNotifications } from "@/features/notifications/queries";
import { GlobalSearch } from "@/features/search/components/GlobalSearch";
import { requireSession } from "@/features/auth/queries";
import { getCompanyConfig } from "@/lib/config/service";

/**
 * Authenticated app shell (Phase 4, §8). Calls `requireSession()` so every
 * nested route is guarded server-side as well as by middleware (defense in
 * depth). Reads the tenant's feature flags once, here, through the Configuration
 * Service and passes them (plus the role) to the role-filtered Sidebar.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSession();
  const [{ featureFlags }, notifications] = await Promise.all([
    getCompanyConfig(user.organizationId),
    getRecentNotifications(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar
        userLabel={user.name || user.email}
        search={<GlobalSearch />}
        notifications={<NotificationBell initialNotifications={notifications} />}
      />
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r p-4 md:block">
          <Sidebar role={user.role} featureFlags={featureFlags} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
