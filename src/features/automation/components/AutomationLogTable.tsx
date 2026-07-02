import { History } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { getRuleLogs } from "@/features/automation/queries";
import { RUN_STATUS_COLORS, RUN_STATUS_LABELS } from "@/features/automation/labels";

/**
 * Read-only execution history for a rule (§15.5). Every firing — SUCCESS,
 * SKIPPED (conditions not met), or FAILED — is recorded here, so an Owner can
 * see exactly what a rule did and when. Server component; the read is OWNER-only
 * and org-scoped via the rule-ownership check in `getRuleLogs`.
 */
export async function AutomationLogTable({ ruleId }: { ruleId: string }) {
  const logs = await getRuleLogs(ruleId);

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No executions yet"
        description="Each time this rule's trigger fires, the outcome will be recorded here."
      />
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {logs.map((log) => (
        <li key={log.id} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                RUN_STATUS_COLORS[log.status],
              )}
            >
              {RUN_STATUS_LABELS[log.status]}
            </span>
            {log.resultMessage ? (
              <p className="text-muted-foreground mt-1 truncate text-sm">{log.resultMessage}</p>
            ) : null}
          </div>
          <p className="text-muted-foreground shrink-0 text-xs">
            {new Date(log.executedAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
