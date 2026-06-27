import type { Metadata } from "next";

import {
  PageContent,
  PageHeader,
  PageSection,
} from "@/features/layout/components/PageLayout";
import { LocaleForm } from "@/features/settings/components/LocaleForm";
import { saveCompanyConfigAction } from "@/features/settings/actions";
import { getCompanyConfig } from "@/lib/config/service";
import { requireRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Business Hours & Locale" };

/** Business Hours & Locale settings — OWNER only (Phase 4, §8). */
export default async function LocaleSettingsPage() {
  const session = await requireRole(["OWNER"]);
  const config = await getCompanyConfig(session.organizationId);

  return (
    <>
      <PageHeader
        title="Business Hours & Locale"
        breadcrumb={["Settings", "Business Hours & Locale"]}
        description="Timezone, currency, and date formatting."
      />
      <PageContent>
        <PageSection title="Locale">
          <LocaleForm
            initial={{
              timezone: config.businessHours.timezone,
              currency: config.locale.currency,
              dateFormat: config.locale.dateFormat,
            }}
            saveConfig={saveCompanyConfigAction}
          />
        </PageSection>
      </PageContent>
    </>
  );
}
