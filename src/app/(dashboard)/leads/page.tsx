import type { Metadata } from "next";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getLeads, getLeadSourceOptions } from "@/features/leads/queries";
import { getAssignableUsers } from "@/features/users/queries";
import { LeadList } from "@/features/leads/components/LeadList";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["OWNER", "STAFF"]);
  const params = await searchParams;
  const [{ rows, totalCount, params: tableParams }, sources, staff] = await Promise.all([
    getLeads(params),
    getLeadSourceOptions(),
    getAssignableUsers(["OWNER", "STAFF"]),
  ]);

  return (
    <PageLayout>
      <PageHeader title="Leads" description="Your sales pipeline from first contact to won or lost." />
      <PageContent>
        <LeadList rows={rows} totalCount={totalCount} params={tableParams} sources={sources} staff={staff} />
      </PageContent>
    </PageLayout>
  );
}
