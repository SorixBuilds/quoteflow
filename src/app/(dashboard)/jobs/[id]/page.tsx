import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { EntityDetailTabs, parseDetailTab } from "@/components/shared/EntityDetailTabs";
import { requireRole } from "@/lib/permissions";
import { getJobById } from "@/features/jobs/queries";
import { getAssignableUsers } from "@/features/users/queries";
import { JobOverview } from "@/features/jobs/components/JobOverview";

export const metadata: Metadata = { title: "Job" };

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(["OWNER", "STAFF", "FIELD"]);
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const job = await getJobById(id);
  if (!job) notFound();

  const technicians = session.role !== "FIELD" ? await getAssignableUsers(["FIELD"]) : [];
  const tab = parseDetailTab(Array.isArray(tabParam) ? tabParam[0] : tabParam);

  return (
    <PageLayout>
      <PageHeader
        title={`Job — ${job.customerName}`}
        breadcrumb={[{ label: "Jobs", href: "/jobs" }, job.quoteNumber]}
      />
      <PageContent>
        <EntityDetailTabs
          entityType="JOB"
          entityId={job.id}
          basePath={`/jobs/${job.id}`}
          tab={tab}
          overview={<JobOverview job={job} technicians={technicians} />}
        />
      </PageContent>
    </PageLayout>
  );
}
