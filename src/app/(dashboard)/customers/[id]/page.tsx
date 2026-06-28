import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { EntityDetailTabs, parseDetailTab } from "@/components/shared/EntityDetailTabs";
import { requireRole } from "@/lib/permissions";
import { getCompanyConfig } from "@/lib/config/service";
import { getCustomerById } from "@/features/customers/queries";
import { CustomerOverview } from "@/features/customers/components/CustomerOverview";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(["OWNER", "STAFF"]);
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const [customer, config] = await Promise.all([
    getCustomerById(id),
    getCompanyConfig(session.organizationId),
  ]);
  if (!customer) notFound();

  const tab = parseDetailTab(Array.isArray(tabParam) ? tabParam[0] : tabParam);

  return (
    <PageLayout>
      <PageHeader title={customer.name} breadcrumb={[{ label: "Customers", href: "/customers" }, customer.name]} />
      <PageContent>
        <EntityDetailTabs
          entityType="CUSTOMER"
          entityId={customer.id}
          basePath={`/customers/${customer.id}`}
          tab={tab}
          overview={<CustomerOverview customer={customer} currency={config.locale.currency} />}
        />
      </PageContent>
    </PageLayout>
  );
}
