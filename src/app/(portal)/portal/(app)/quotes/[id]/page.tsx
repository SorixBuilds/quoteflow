import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { requirePortalSession } from "@/features/customer-portal/session";
import { getPortalQuote, getPortalEntityFiles } from "@/features/customer-portal/queries";
import { PortalQuoteView } from "@/features/customer-portal/components/PortalQuoteView";

export const metadata: Metadata = { title: "Quote" };

export default async function PortalQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePortalSession();
  const { id } = await params;

  const quote = await getPortalQuote(session, id);
  if (!quote) notFound();

  // Files are listed only after ownership is proven by the same scoped session.
  const attachments = (await getPortalEntityFiles(session, "QUOTE", id)) ?? [];

  return (
    <div className="space-y-6">
      <Link href="/portal/quotes" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm [&_svg]:size-4">
        <ArrowLeft />
        Back to quotes
      </Link>
      <PortalQuoteView quote={quote} attachments={attachments} />
    </div>
  );
}
