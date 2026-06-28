import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getCompanyConfig } from "@/lib/config/service";
import { getBuilderCatalog } from "@/features/catalog/cache";
import { getCustomerOptions } from "@/features/customers/queries";
import { getQuoteById } from "@/features/quotes/queries";
import { updateQuote } from "@/features/quotes/actions";
import { QuoteBuilder } from "@/features/quote-builder/components/QuoteBuilder";
import { newLineKey, type BuilderLine } from "@/features/quote-builder/store";

export const metadata: Metadata = { title: "Edit quote" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole(["OWNER", "STAFF"]);
  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) notFound();
  // §11: /edit is only reachable while DRAFT.
  if (quote.status !== "DRAFT") redirect(`/quotes/${id}`);

  const [catalog, customers, config] = await Promise.all([
    getBuilderCatalog(session.organizationId),
    getCustomerOptions(),
    getCompanyConfig(session.organizationId),
  ]);

  const lines: BuilderLine[] = quote.items.map((it) => ({
    key: newLineKey(),
    serviceId: it.serviceId,
    description: it.description,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    taxRateId: it.taxRateId,
  }));

  return (
    <PageLayout>
      <PageHeader
        title={`Edit ${quote.quoteNumber}`}
        breadcrumb={[{ label: "Quotes", href: "/quotes" }, { label: quote.quoteNumber, href: `/quotes/${id}` }, "Edit"]}
      />
      <PageContent>
        <QuoteBuilder
          mode="edit"
          catalog={catalog}
          customers={customers}
          currency={config.locale.currency}
          initial={{
            customerId: quote.customerId,
            lines,
            discountType: quote.discountType ?? "",
            discountValue: quote.discountValue ?? "",
            notes: quote.notes ?? "",
            terms: quote.terms ?? "",
            issueDate: quote.issueDate ? quote.issueDate.toISOString().slice(0, 10) : "",
            expiryDate: quote.expiryDate ? quote.expiryDate.toISOString().slice(0, 10) : "",
          }}
          onSave={updateQuote.bind(null, id)}
        />
      </PageContent>
    </PageLayout>
  );
}
