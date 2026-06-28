import type { Metadata } from "next";

import { PageSection } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getCompanyConfig } from "@/lib/config/service";
import { getCategoryOptions, getServices } from "@/features/catalog/queries";
import { createService, setServiceActive, updateService } from "@/features/catalog/actions";
import { ServiceManager } from "@/features/catalog/components/ServiceManager";

export const metadata: Metadata = { title: "Services · Catalog" };

export default async function ServicesCatalogPage() {
  const session = await requireRole(["OWNER", "STAFF"]);
  const [rows, categories, config] = await Promise.all([
    getServices(),
    getCategoryOptions(),
    getCompanyConfig(session.organizationId),
  ]);

  return (
    <PageSection title="Services">
      <ServiceManager
        rows={rows}
        categories={categories}
        currency={config.locale.currency}
        canWrite={session.role === "OWNER"}
        createAction={createService}
        updateAction={updateService}
        setActiveAction={setServiceActive}
      />
    </PageSection>
  );
}
