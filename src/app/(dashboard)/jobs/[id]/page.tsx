import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  PageActions,
  PageContent,
  PageHeader,
  PageLayout,
} from "@/features/layout/components/PageLayout";
import { EntityDetailTabs, parseDetailTab } from "@/components/shared/EntityDetailTabs";
import { requireRole } from "@/lib/permissions";
import { getCompanyConfig } from "@/lib/config/service";
import { getJobById } from "@/features/jobs/queries";
import { getAssignableUsers } from "@/features/users/queries";
import { JobOverview } from "@/features/jobs/components/JobOverview";
import { DocumentDownloadLinks } from "@/features/documents/components/DocumentDownloadLinks";

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
  const config = await getCompanyConfig(session.organizationId);

  return (
    <PageLayout>
      <PageHeader
        title={`Job — ${job.customerName}`}
        breadcrumb={[{ label: "Jobs", href: "/jobs" }, job.quoteNumber]}
      >
        <PageActions>
          <DocumentDownloadLinks
            entityId={job.id}
            links={[
              { type: "job-sheet", label: "Job Sheet" },
              { type: "work-order", label: "Work Order" },
            ]}
          />
        </PageActions>
      </PageHeader>
      <PageContent>
        <EntityDetailTabs
          entityType="JOB"
          entityId={job.id}
          basePath={`/jobs/${job.id}`}
          tab={tab}
          overview={
            <JobOverview
              job={job}
              technicians={technicians}
              aiEnabled={config.featureFlags.ai}
            />
          }
        />
      </PageContent>
    </PageLayout>
  );
}
