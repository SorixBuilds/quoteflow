import type { Metadata } from "next";

import { PageSection } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getCompanyConfig } from "@/lib/config/service";
import { getLeadSources } from "@/features/catalog/queries";
import { createLeadSource, setLeadSourceActive, updateLeadSource } from "@/features/catalog/actions";
import { LeadSourceManager } from "@/features/catalog/components/LeadSourceManager";

export const metadata: Metadata = { title: "Lead Sources · Catalog" };

export default async function LeadSourcesCatalogPage() {
  const session = await requireRole(["OWNER", "STAFF"]);
  const [rows, config] = await Promise.all([
    getLeadSources(),
    getCompanyConfig(session.organizationId),
  ]);

  return (
    <PageSection title="Lead sources">
      <LeadSourceManager
        rows={rows}
        currency={config.locale.currency}
        canWrite={session.role === "OWNER"}
        createAction={createLeadSource}
        updateAction={updateLeadSource}
        setActiveAction={setLeadSourceActive}
      />
    </PageSection>
  );
}
