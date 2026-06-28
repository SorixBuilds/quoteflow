import type { Metadata } from "next";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getCustomers } from "@/features/customers/queries";
import { CustomerList } from "@/features/customers/components/CustomerList";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["OWNER", "STAFF"]);
  const params = await searchParams;
  const { rows, totalCount, params: tableParams } = await getCustomers(params);

  return (
    <PageLayout>
      <PageHeader title="Customers" description="People and businesses you do work for." />
      <PageContent>
        <CustomerList rows={rows} totalCount={totalCount} params={tableParams} />
      </PageContent>
    </PageLayout>
  );
}
