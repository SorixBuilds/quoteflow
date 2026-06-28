"use client";

import { useTransition } from "react";

import { cn } from "@/lib/utils";
import { showErrorToast } from "@/components/shared/SuccessToast";
import type { TaskEntry } from "@/features/tasks/queries";
import type { ActionResult } from "@/types";

/** One task row with a done/undone checkbox (Phase 5, §12). */
export function TaskRow({
  task,
  onToggle,
}: {
  task: TaskEntry;
  onToggle: (taskId: string, done: boolean) => Promise<ActionResult<null>>;
}) {
  const [isPending, startTransition] = useTransition();
  const done = task.status === "DONE";

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <input
        type="checkbox"
        checked={done}
        disabled={isPending}
        onChange={() => {
          startTransition(async () => {
            const result = await onToggle(task.id, !done);
            if (!result.success) showErrorToast(result.error);
          });
        }}
        className="size-4 rounded"
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm",
            done ? "text-muted-foreground line-through" : "text-foreground",
          )}
        >
          {task.title}
        </p>
        <p className="text-muted-foreground text-xs">
          {task.assigneeName}
          {task.dueDate ? ` · due ${task.dueDate.toLocaleDateString()}` : ""}
        </p>
      </div>
    </li>
  );
}
