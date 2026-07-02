import type { Metadata } from "next";

import {
  PageContent,
  PageHeader,
  PageSection,
} from "@/features/layout/components/PageLayout";
import { EmailSettingsForm } from "@/features/settings/components/EmailSettingsForm";
import { EmailPreview } from "@/features/email/components/EmailPreview";
import { saveCompanyConfigAction } from "@/features/settings/actions";
import { getCompanyConfig } from "@/lib/config/service";
import { requireRole } from "@/lib/permissions";

export const metadata: Metadata = { title: "Email Delivery" };

/**
 * Email delivery settings — OWNER only (Phase 6B Step 5, §9, §13). Sender
 * identity + a live, read-only template preview rendered through the real
 * pipeline with sample data.
 */
export default async function EmailSettingsPage() {
  const session = await requireRole(["OWNER"]);
  const config = await getCompanyConfig(session.organizationId);

  return (
    <>
      <PageHeader
        title="Email Delivery"
        breadcrumb={["Settings", "Email Delivery"]}
        description="Sender identity and branding applied to every email QuoteFlow sends."
      />
      <PageContent>
        <PageSection title="Sender identity">
          <EmailSettingsForm
            initial={{
              senderName: config.email.senderName,
              senderEmail: config.email.senderEmail,
              replyTo: config.email.replyTo,
              footer: config.email.footer,
              signature: config.email.signature,
            }}
            saveConfig={saveCompanyConfigAction}
          />
        </PageSection>
        <PageSection title="Preview">
          <EmailPreview />
        </PageSection>
      </PageContent>
    </>
  );
}
