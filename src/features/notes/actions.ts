"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { EntityType } from "@prisma/client";

import { db } from "@/lib/db";
import { requireActiveUser, requireCompanyScope, requireSession } from "@/lib/permissions";
import { logActivity } from "@/features/activity/actions";
import { toActionError } from "@/lib/errors";
import type { ActionResult } from "@/types";

/**
 * Notes write path (Phase 5 — completes the §12 detail-tab shell). Adding a note
 * also logs a `note_added` Activity entry (§24 taxonomy) so the timeline reflects
 * it. Company-scoped and authenticated like every Phase 5 action.
 */

const addNoteSchema = z.object({
  entityType: z.enum(["LEAD", "QUOTE", "JOB", "CUSTOMER", "INVOICE"]),
  entityId: z.string().uuid(),
  content: z.string().trim().min(1, "A note cannot be empty.").max(5000),
});

export async function addNote(input: {
  entityType: EntityType;
  entityId: string;
  content: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = addNoteSchema.parse(input);

    const note = await db.note.create({
      data: {
        organizationId,
        entityType: data.entityType,
        entityId: data.entityId,
        content: data.content,
        createdById: session.id,
      },
      select: { id: true },
    });

    await logActivity({
      organizationId,
      entityType: data.entityType,
      entityId: data.entityId,
      type: "note_added",
      createdById: session.id,
    });

    revalidatePath("/", "layout");
    return { success: true, data: { id: note.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
