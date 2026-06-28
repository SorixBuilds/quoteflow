import type { EntityType } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Tasks read path (Phase 5 — completes the §12 detail-tab shell). Polymorphic
 * and company-scoped, mirroring Activity/Notes. Phase 4 built the `Task` model
 * but no UI; this is the minimal read surface the detail pages consume.
 */

export type TaskEntry = {
  id: string;
  title: string;
  status: "OPEN" | "DONE";
  dueDate: Date | null;
  assigneeName: string;
};

export async function getTasksForEntity(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
): Promise<TaskEntry[]> {
  const rows = await db.task.findMany({
    where: { organizationId, entityType, entityId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      assignedTo: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    dueDate: row.dueDate,
    assigneeName: row.assignedTo.name,
  }));
}
