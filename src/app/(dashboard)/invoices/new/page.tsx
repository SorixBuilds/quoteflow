import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getJobForInvoice } from "@/features/invoices/queries";
import { CreateInvoiceForm } from "@/features/invoices/components/CreateInvoiceForm";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["OWNER", "STAFF"]);
  const { jobId } = await searchParams;
  const id = Array.isArray(jobId) ? jobId[0] : jobId;
  if (!id) notFound();
  const job = await getJobForInvoice(id);
  if (!job) notFound();

  return (
    <PageLayout>
      <PageHeader title="New invoice" breadcrumb={[{ label: "Invoices", href: "/invoices" }, "New"]} />
      <PageContent>
        <CreateInvoiceForm job={job} />
      </PageContent>
    </PageLayout>
  );
}
