import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  PageContent,
  PageHeader,
  PageSection,
} from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getRuleDetail } from "@/features/automation/queries";
import { RuleBuilder } from "@/features/automation/components/RuleBuilder";
import { AutomationLogTable } from "@/features/automation/components/AutomationLogTable";

export const metadata: Metadata = { title: "Edit automation" };

/** Edit a rule and review its execution history — OWNER only (§15.5). */
export default async function EditAutomationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["OWNER"]);
  const { id } = await params;
  const rule = await getRuleDetail(id);
  if (!rule) notFound();

  return (
    <>
      <PageHeader
        title={rule.name}
        breadcrumb={["Settings", "Automations", rule.name]}
        description="Edit this rule, or review every time it has fired."
      />
      <PageContent>
        <PageSection title="Rule">
          <RuleBuilder
            mode="edit"
            ruleId={rule.id}
            initial={{
              name: rule.name,
              triggerType: rule.triggerType,
              isActive: rule.isActive,
              conditions: rule.conditions,
              actions: rule.actions,
            }}
          />
        </PageSection>
        <PageSection title="Execution history">
          <AutomationLogTable ruleId={rule.id} />
        </PageSection>
      </PageContent>
    </>
  );
}
