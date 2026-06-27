import type { Metadata } from "next";

import {
  PageContent,
  PageHeader,
  PageSection,
} from "@/features/layout/components/PageLayout";
import { BrandingForm } from "@/features/settings/components/BrandingForm";
import { saveCompanyConfigAction } from "@/features/settings/actions";
import { getCompanyConfig } from "@/lib/config/service";
import { requireRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "PDF & Email Branding" };

/** PDF & Email Branding settings — OWNER only (Phase 4, §8). */
export default async function BrandingSettingsPage() {
  const session = await requireRole(["OWNER"]);
  const config = await getCompanyConfig(session.organizationId);

  return (
    <>
      <PageHeader
        title="PDF & Email Branding"
        breadcrumb={["Settings", "PDF & Email"]}
        description="Presentation of generated PDFs and quote-sent email templates."
      />
      <PageContent>
        <PageSection title="PDF & Email">
          <BrandingForm
            initial={{
              headerText: config.pdf.headerText,
              footerText: config.pdf.footerText,
              showLogo: config.pdf.showLogo,
              quoteSentSubjectTemplate: config.email.quoteSentSubjectTemplate,
              quoteSentBodyTemplate: config.email.quoteSentBodyTemplate,
            }}
            saveConfig={saveCompanyConfigAction}
          />
        </PageSection>
      </PageContent>
    </>
  );
}
