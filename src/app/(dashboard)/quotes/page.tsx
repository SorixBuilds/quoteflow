import type { Metadata } from "next";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getQuotes } from "@/features/quotes/queries";
import { QuoteList } from "@/features/quotes/components/QuoteList";

export const metadata: Metadata = { title: "Quotes" };

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["OWNER", "STAFF"]);
  const params = await searchParams;
  const { rows, totalCount, params: tableParams } = await getQuotes(params);

  return (
    <PageLayout>
      <PageHeader title="Quotes" description="Build, send, and track quotes through to acceptance." />
      <PageContent>
        <QuoteList rows={rows} totalCount={totalCount} params={tableParams} />
      </PageContent>
    </PageLayout>
  );
}
