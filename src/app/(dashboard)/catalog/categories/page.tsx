import type { Metadata } from "next";

import { PageSection } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getServiceCategories } from "@/features/catalog/queries";
import { createServiceCategory, updateServiceCategory } from "@/features/catalog/actions";
import { ServiceCategoryManager } from "@/features/catalog/components/ServiceCategoryManager";

export const metadata: Metadata = { title: "Categories · Catalog" };

export default async function CategoriesCatalogPage() {
  const session = await requireRole(["OWNER", "STAFF"]);
  const rows = await getServiceCategories();

  return (
    <PageSection title="Service categories">
      <ServiceCategoryManager
        rows={rows}
        canWrite={session.role === "OWNER"}
        createAction={createServiceCategory}
        updateAction={updateServiceCategory}
      />
    </PageSection>
  );
}
