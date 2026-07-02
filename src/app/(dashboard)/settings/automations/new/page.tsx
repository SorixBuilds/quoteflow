import type { Metadata } from "next";

import {
  PageContent,
  PageHeader,
  PageSection,
} from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { RuleBuilder } from "@/features/automation/components/RuleBuilder";

export const metadata: Metadata = { title: "New automation" };

/** Create a new automation rule — OWNER only (§15.5, §15.8). */
export default async function NewAutomationPage() {
  await requireRole(["OWNER"]);

  return (
    <>
      <PageHeader
        title="New automation"
        breadcrumb={["Settings", "Automations", "New"]}
        description="Pick a trigger, add optional conditions, then choose what should happen."
      />
      <PageContent>
        <PageSection>
          <RuleBuilder mode="create" />
        </PageSection>
      </PageContent>
    </>
  );
}
