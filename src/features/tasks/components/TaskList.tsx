import type { EntityType } from "@prisma/client";
import { ListTodo } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { requireSession } from "@/features/auth/queries";
import { getTasksForEntity, type TaskEntry } from "@/features/tasks/queries";
import { addTask, toggleTask } from "@/features/tasks/actions";
import { TaskRow } from "@/features/tasks/components/TaskRow";
import { AddTaskForm } from "@/features/tasks/components/AddTaskForm";

/**
 * Polymorphic tasks panel (Phase 5, §12). Embedded unmodified by every entity
 * detail view's Tasks tab. Server component scopes the read; the add form and
 * per-row toggle are client islands calling the task actions.
 */
export function TaskListView({ tasks }: { tasks: TaskEntry[] }) {
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListTodo}
        title="No tasks yet"
        description="Track follow-ups for this record below."
      />
    );
  }
  return (
    <ul className="divide-y rounded-md border">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} onToggle={toggleTask} />
      ))}
    </ul>
  );
}

export async function TaskList({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const session = await requireSession();
  const tasks = await getTasksForEntity(session.organizationId, entityType, entityId);
  return (
    <div className="space-y-4">
      <AddTaskForm entityType={entityType} entityId={entityId} action={addTask} />
      <TaskListView tasks={tasks} />
    </div>
  );
}
