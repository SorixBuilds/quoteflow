import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { EntityDetailTabs, parseDetailTab } from "@/components/shared/EntityDetailTabs";
import { requireRole } from "@/lib/permissions";
import { getQuoteById } from "@/features/quotes/queries";
import { createQuoteShareToken } from "@/lib/tokens";
import { env } from "@/lib/env";
import { QuoteOverview } from "@/features/quotes/components/QuoteOverview";
import { PageActions } from "@/features/layout/components/PageLayout";
import { DocumentDownloadLinks } from "@/features/documents/components/DocumentDownloadLinks";

export const metadata: Metadata = { title: "Quote" };

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["OWNER", "STAFF"]);
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const quote = await getQuoteById(id);
  if (!quote) notFound();

  const tab = parseDetailTab(Array.isArray(tabParam) ? tabParam[0] : tabParam);
  // Share link is only meaningful once the quote has been sent.
  const shareUrl =
    quote.status === "DRAFT"
      ? null
      : `${env.NEXT_PUBLIC_APP_URL}/q/${createQuoteShareToken(quote.id)}`;

  return (
    <PageLayout>
      <PageHeader
        title={`${quote.quoteNumber}${quote.version > 1 ? ` (v${quote.version})` : ""}`}
        breadcrumb={[{ label: "Quotes", href: "/quotes" }, quote.quoteNumber]}
      >
        <PageActions>
          <DocumentDownloadLinks
            entityId={quote.id}
            links={[{ type: "quote", label: "Download PDF" }]}
          />
        </PageActions>
      </PageHeader>
      <PageContent>
        <EntityDetailTabs
          entityType="QUOTE"
          entityId={quote.id}
          basePath={`/quotes/${quote.id}`}
          tab={tab}
          overview={<QuoteOverview quote={quote} shareUrl={shareUrl} />}
        />
      </PageContent>
    </PageLayout>
  );
}
