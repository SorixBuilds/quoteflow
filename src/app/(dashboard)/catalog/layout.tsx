import type { ReactNode } from "react";

import { PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { CatalogNav } from "@/features/catalog/components/CatalogNav";
import { requireRole } from "@/lib/permissions";

/**
 * Catalog shell (Phase 5, §10, §11). OWNER/STAFF only — a FIELD user reaching
 * here is redirected by `requireRole`. Write access is gated per-page (OWNER).
 */
export default async function CatalogLayout({ children }: { children: ReactNode }) {
  await requireRole(["OWNER", "STAFF"]);
  return (
    <PageLayout>
      <PageHeader
        title="Catalog"
        breadcrumb={["Catalog"]}
        description="Services, categories, tax rates, and lead sources used across quotes and leads."
      />
      <div className="space-y-6">
        <CatalogNav />
        {children}
      </div>
    </PageLayout>
  );
}
