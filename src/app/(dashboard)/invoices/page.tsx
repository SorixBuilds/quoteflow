import type { Metadata } from "next";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getInvoices } from "@/features/invoices/queries";
import { InvoiceList } from "@/features/invoices/components/InvoiceList";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["OWNER", "STAFF"]);
  const params = await searchParams;
  const { rows, totalCount, params: tableParams } = await getInvoices(params);

  return (
    <PageLayout>
      <PageHeader title="Invoices" description="Billing and accounts receivable." />
      <PageContent>
        <InvoiceList rows={rows} totalCount={totalCount} params={tableParams} />
      </PageContent>
    </PageLayout>
  );
}
