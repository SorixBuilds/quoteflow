import type { ReactNode } from "react";

import { PageLayout } from "@/features/layout/components/PageLayout";
import { SettingsNav } from "@/features/settings/components/SettingsNav";
import { requireSession } from "@/features/auth/queries";

/**
 * Settings section shell (Phase 4, §8, §10). Provides the shared `<PageLayout>`
 * and the role-aware sub-navigation for every settings route. Config sections
 * self-gate to OWNER inside their own page; the Account tab stays available to
 * all roles, so this layout only requires a session (not a role).
 */
export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSession();

  return (
    <PageLayout>
      <SettingsNav role={user.role} />
      <div className="mt-6">{children}</div>
    </PageLayout>
  );
}
