import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardNotices } from "@/components/auth/DashboardNotices";
import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireSession } from "@/features/auth/queries";
import { getCompanyConfig } from "@/lib/config/service";
import { getDashboardData } from "@/features/dashboard/queries";
import { DashboardView } from "@/features/dashboard/components/DashboardView";

export const metadata: Metadata = { title: "Dashboard" };

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Org dashboard (Phase 5, §33). OWNER/STAFF only — a FIELD user is redirected to
 * their jobs (§11). Renders the KPI row, lead pipeline, lead-source performance,
 * and the org-wide recent-activity feed against live data.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSession();
  if (user.role === "FIELD") redirect("/jobs");

  const { error } = await searchParams;
  const config = await getCompanyConfig(user.organizationId);
  const data = await getDashboardData(config.locale.currency);

  return (
    <PageLayout className="max-w-6xl">
      <DashboardNotices error={firstParam(error)} />
      <PageHeader
        title={`Welcome, ${user.name || user.email}`}
        description="Your business at a glance."
      />
      <PageContent>
        <DashboardView data={data} />
      </PageContent>
    </PageLayout>
  );
}
