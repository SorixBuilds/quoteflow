import type { Metadata } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  PageActions,
  PageContent,
  PageHeader,
} from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { listRulesForOrg } from "@/features/automation/queries";
import { RuleList } from "@/features/automation/components/RuleList";

export const metadata: Metadata = { title: "Automations" };

/**
 * Automation rules management (§15.5, §13) — OWNER only. Lists the org's rules
 * with their enable/disable state and a link to create a new one.
 */
export default async function AutomationsPage() {
  await requireRole(["OWNER"]);
  const rules = await listRulesForOrg();

  return (
    <>
      <PageHeader
        title="Automations"
        breadcrumb={["Settings", "Automations"]}
        description="Automatically send an email, notify your team, or create a task when something happens."
      >
        <PageActions>
          <Link href="/settings/automations/new" className={cn(buttonVariants())}>
            New rule
          </Link>
        </PageActions>
      </PageHeader>
      <PageContent>
        <RuleList rules={rules} />
      </PageContent>
    </>
  );
}
