import type { Metadata } from "next";

import {
  PageContent,
  PageHeader,
  PageSection,
} from "@/features/layout/components/PageLayout";
import { FeatureFlagsDisplay } from "@/features/settings/components/FeatureFlagsDisplay";
import { getCompanyConfig } from "@/lib/config/service";
import { requireRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Feature Flags" };

/** Feature Flags — read-only display, OWNER only (Phase 4, §8, §20). */
export default async function FeatureFlagsSettingsPage() {
  const session = await requireRole(["OWNER"]);
  const config = await getCompanyConfig(session.organizationId);

  return (
    <>
      <PageHeader
        title="Feature Flags"
        breadcrumb={["Settings", "Feature Flags"]}
        description="Modules available to your organization. Toggles appear here once a feature exists to enable."
      />
      <PageContent>
        <PageSection title="Modules">
          <FeatureFlagsDisplay featureFlags={config.featureFlags} />
        </PageSection>
      </PageContent>
    </>
  );
}
