import type { Metadata } from "next";

import {
  PageContent,
  PageHeader,
  PageSection,
} from "@/features/layout/components/PageLayout";
import { CompanyProfileForm } from "@/features/settings/components/CompanyProfileForm";
import {
  saveCompanyConfigAction,
  saveOrganizationProfileAction,
} from "@/features/settings/actions";
import { db } from "@/lib/db";
import { getCompanyConfig } from "@/lib/config/service";
import { requireRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Company Profile" };

/** Company Profile settings — OWNER only (Phase 4, §8). */
export default async function CompanyProfileSettingsPage() {
  const session = await requireRole(["OWNER"]);
  const [org, config] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: session.organizationId },
      select: { name: true, logoUrl: true },
    }),
    getCompanyConfig(session.organizationId),
  ]);

  return (
    <>
      <PageHeader
        title="Company Profile"
        breadcrumb={["Settings", "Company Profile"]}
        description="Your organization's name and brand colors."
      />
      <PageContent>
        <PageSection title="Profile">
          <CompanyProfileForm
            initial={{
              name: org.name,
              logoUrl: org.logoUrl ?? "",
              primaryColor: config.branding.primaryColor,
              accentColor: config.branding.accentColor,
            }}
            saveConfig={saveCompanyConfigAction}
            saveProfile={saveOrganizationProfileAction}
          />
        </PageSection>
      </PageContent>
    </>
  );
}
