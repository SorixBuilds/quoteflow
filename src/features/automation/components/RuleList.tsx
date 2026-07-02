import Link from "next/link";
import { Workflow } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import type { AutomationRuleListItem } from "@/features/automation/queries";
import { triggerLabel } from "@/features/automation/labels";
import { RuleToggle } from "@/features/automation/components/RuleToggle";

/**
 * The automation rules list (§15.5). Each row links to the rule's detail/editor,
 * shows its trigger and a summary of its conditions/actions, and carries the
 * enable/disable control. Pure presentation over the OWNER-scoped query result.
 */
export function RuleList({ rules }: { rules: AutomationRuleListItem[] }) {
  if (rules.length === 0) {
    return (
      <EmptyState
        icon={Workflow}
        title="No automations yet"
        description="Create a rule to automatically send an email, notify your team, or add a task when something happens."
      />
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {rules.map((rule) => (
        <li key={rule.id} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/settings/automations/${rule.id}`}
                className="text-foreground truncate text-sm font-medium hover:underline"
              >
                {rule.name}
              </Link>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  rule.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700",
                )}
              >
                {rule.isActive ? "Active" : "Disabled"}
              </span>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              When {triggerLabel(rule.triggerType)} · {rule.conditionCount} condition
              {rule.conditionCount === 1 ? "" : "s"} · {rule.actionCount} action
              {rule.actionCount === 1 ? "" : "s"}
            </p>
          </div>
          <RuleToggle id={rule.id} isActive={rule.isActive} />
        </li>
      ))}
    </ul>
  );
}
