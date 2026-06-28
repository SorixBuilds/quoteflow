import type { Metadata } from "next";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getJobs } from "@/features/jobs/queries";
import { getAssignableUsers } from "@/features/users/queries";
import { JobList } from "@/features/jobs/components/JobList";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(["OWNER", "STAFF", "FIELD"]);
  const params = await searchParams;
  const canManage = session.role !== "FIELD";
  const [{ rows, totalCount, params: tableParams }, technicians] = await Promise.all([
    getJobs(params),
    canManage ? getAssignableUsers(["FIELD"]) : Promise.resolve([]),
  ]);

  return (
    <PageLayout>
      <PageHeader title="Jobs" description={canManage ? "Scheduled work across your team." : "Your assigned jobs."} />
      <PageContent>
        <JobList
          rows={rows}
          totalCount={totalCount}
          params={tableParams}
          canManage={canManage}
          technicians={technicians}
        />
      </PageContent>
    </PageLayout>
  );
}
