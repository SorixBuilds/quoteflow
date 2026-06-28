import type { Metadata } from "next";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getCompanyConfig } from "@/lib/config/service";
import { getBuilderCatalog } from "@/features/catalog/cache";
import { getCustomerOptions } from "@/features/customers/queries";
import { createQuote } from "@/features/quotes/actions";
import { QuoteBuilder } from "@/features/quote-builder/components/QuoteBuilder";

export const metadata: Metadata = { title: "New quote" };

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(["OWNER", "STAFF"]);
  const { leadId } = await searchParams;
  const [catalog, customers, config] = await Promise.all([
    getBuilderCatalog(session.organizationId),
    getCustomerOptions(),
    getCompanyConfig(session.organizationId),
  ]);

  return (
    <PageLayout>
      <PageHeader title="New quote" breadcrumb={[{ label: "Quotes", href: "/quotes" }, "New"]} />
      <PageContent>
        <QuoteBuilder
          mode="create"
          catalog={catalog}
          customers={customers}
          currency={config.locale.currency}
          leadId={Array.isArray(leadId) ? leadId[0] : leadId}
          onSave={createQuote}
        />
      </PageContent>
    </PageLayout>
  );
}
