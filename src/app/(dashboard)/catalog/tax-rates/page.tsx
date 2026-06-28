import type { Metadata } from "next";

import { PageSection } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getTaxRates } from "@/features/catalog/queries";
import { createTaxRate, setDefaultTaxRate, updateTaxRate } from "@/features/catalog/actions";
import { TaxRateManager } from "@/features/catalog/components/TaxRateManager";

export const metadata: Metadata = { title: "Tax Rates · Catalog" };

export default async function TaxRatesCatalogPage() {
  const session = await requireRole(["OWNER", "STAFF"]);
  const rows = await getTaxRates();

  return (
    <PageSection title="Tax rates" description="Exactly one rate is the organization default, applied to lines without an explicit rate.">
      <TaxRateManager
        rows={rows}
        canWrite={session.role === "OWNER"}
        createAction={createTaxRate}
        updateAction={updateTaxRate}
        setDefaultAction={setDefaultTaxRate}
      />
    </PageSection>
  );
}
