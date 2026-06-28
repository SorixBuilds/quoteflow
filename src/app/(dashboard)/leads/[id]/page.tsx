import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { EntityDetailTabs, parseDetailTab } from "@/components/shared/EntityDetailTabs";
import { requireRole } from "@/lib/permissions";
import { getCompanyConfig } from "@/lib/config/service";
import { getLeadById, getLeadSourceOptions } from "@/features/leads/queries";
import { getAssignableUsers } from "@/features/users/queries";
import { LeadOverview } from "@/features/leads/components/LeadOverview";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(["OWNER", "STAFF"]);
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const [lead, sources, staff, config] = await Promise.all([
    getLeadById(id),
    getLeadSourceOptions(),
    getAssignableUsers(["OWNER", "STAFF"]),
    getCompanyConfig(session.organizationId),
  ]);
  if (!lead) notFound();

  const tab = parseDetailTab(Array.isArray(tabParam) ? tabParam[0] : tabParam);

  return (
    <PageLayout>
      <PageHeader title={lead.name} breadcrumb={[{ label: "Leads", href: "/leads" }, lead.name]} />
      <PageContent>
        <EntityDetailTabs
          entityType="LEAD"
          entityId={lead.id}
          basePath={`/leads/${lead.id}`}
          tab={tab}
          overview={
            <LeadOverview lead={lead} sources={sources} staff={staff} currency={config.locale.currency} />
          }
        />
      </PageContent>
    </PageLayout>
  );
}
