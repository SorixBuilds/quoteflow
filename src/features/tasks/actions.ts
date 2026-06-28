"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { EntityType } from "@prisma/client";

import { db } from "@/lib/db";
import { requireActiveUser, requireCompanyScope, requireSession } from "@/lib/permissions";
import { toActionError } from "@/lib/errors";
import type { ActionResult } from "@/types";

/**
 * Tasks write path (Phase 5 — completes the §12 detail-tab shell). A task added
 * from an entity's Tasks tab is assigned to its creator by default and scoped to
 * that entity. `toggleTask` flips OPEN/DONE, company-scoped so a caller can only
 * touch their own org's tasks.
 */

const addTaskSchema = z.object({
  entityType: z.enum(["LEAD", "QUOTE", "JOB", "CUSTOMER", "INVOICE"]),
  entityId: z.string().uuid(),
  title: z.string().trim().min(1, "A task needs a title.").max(300),
  dueDate: z.string().optional(),
});

export async function addTask(input: {
  entityType: EntityType;
  entityId: string;
  title: string;
  dueDate?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = addTaskSchema.parse(input);

    const task = await db.task.create({
      data: {
        organizationId,
        entityType: data.entityType,
        entityId: data.entityId,
        title: data.title,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        assignedToId: session.id,
        createdById: session.id,
      },
      select: { id: true },
    });

    revalidatePath("/", "layout");
    return { success: true, data: { id: task.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function toggleTask(
  taskId: string,
  done: boolean,
): Promise<ActionResult<null>> {
  try {
    const session = await requireSession();
    const { organizationId } = await requireCompanyScope(session);
    await db.task.updateMany({
      where: { id: taskId, organizationId },
      data: { status: done ? "DONE" : "OPEN" },
    });
    revalidatePath("/", "layout");
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
