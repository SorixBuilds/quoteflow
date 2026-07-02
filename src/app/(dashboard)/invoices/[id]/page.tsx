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
import { getInvoiceById } from "@/features/invoices/queries";
import { InvoiceOverview } from "@/features/invoices/components/InvoiceOverview";
import { DocumentDownloadLinks } from "@/features/documents/components/DocumentDownloadLinks";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["OWNER", "STAFF"]);
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const tab = parseDetailTab(Array.isArray(tabParam) ? tabParam[0] : tabParam);

  return (
    <PageLayout>
      <PageHeader
        title={invoice.invoiceNumber}
        breadcrumb={[{ label: "Invoices", href: "/invoices" }, invoice.invoiceNumber]}
      >
        <PageActions>
          <DocumentDownloadLinks
            entityId={invoice.id}
            links={[
              { type: "invoice", label: "Invoice PDF" },
              { type: "receipt", label: "Receipt PDF" },
            ]}
          />
        </PageActions>
      </PageHeader>
      <PageContent>
        <EntityDetailTabs
          entityType="INVOICE"
          entityId={invoice.id}
          basePath={`/invoices/${invoice.id}`}
          tab={tab}
          overview={<InvoiceOverview invoice={invoice} />}
        />
      </PageContent>
    </PageLayout>
  );
}
