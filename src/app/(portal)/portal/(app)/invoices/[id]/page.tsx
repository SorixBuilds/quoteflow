import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { requirePortalSession } from "@/features/customer-portal/session";
import {
  getPortalAccount,
  getPortalInvoice,
  getPortalEntityFiles,
} from "@/features/customer-portal/queries";
import { PortalInvoiceView } from "@/features/customer-portal/components/PortalInvoiceView";

export const metadata: Metadata = { title: "Invoice" };

export default async function PortalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePortalSession();
  const { id } = await params;

  const [invoice, account] = await Promise.all([
    getPortalInvoice(session, id),
    getPortalAccount(session),
  ]);
  if (!invoice) notFound();
  if (!account) redirect("/portal/login");

  const attachments = (await getPortalEntityFiles(session, "INVOICE", id)) ?? [];

  return (
    <div className="space-y-6">
      <Link href="/portal/invoices" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm [&_svg]:size-4">
        <ArrowLeft />
        Back to invoices
      </Link>
      <PortalInvoiceView invoice={invoice} currency={account.currency} attachments={attachments} />
    </div>
  );
}
