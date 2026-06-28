import type { Metadata } from "next";

import {
  PageContent,
  PageHeader,
  PageSection,
} from "@/features/layout/components/PageLayout";
import { NumberingForm } from "@/features/settings/components/NumberingForm";
import { saveCompanyConfigAction } from "@/features/settings/actions";
import { getCompanyConfig } from "@/lib/config/service";
import { requireRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Numbering & Tax" };

/** Numbering & Tax settings — OWNER only (Phase 4, §8). */
export default async function NumberingSettingsPage() {
  const session = await requireRole(["OWNER"]);
  const config = await getCompanyConfig(session.organizationId);

  return (
    <>
      <PageHeader
        title="Numbering & Tax"
        breadcrumb={["Settings", "Numbering & Tax"]}
        description="How quote and invoice numbers are formatted, and the default tax rate."
      />
      <PageContent>
        <PageSection title="Numbering & Tax">
          <NumberingForm
            initial={{
              quotePrefix: config.numbering.quotePrefix,
              invoicePrefix: config.numbering.invoicePrefix,
              padding: config.numbering.padding,
              resetPolicy: config.numbering.resetPolicy,
              defaultTaxRatePercent: config.taxation.defaultTaxRatePercent,
            }}
            saveConfig={saveCompanyConfigAction}
          />
        </PageSection>
      </PageContent>
    </>
  );
}
