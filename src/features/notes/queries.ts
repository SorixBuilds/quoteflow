import type { EntityType } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Notes read path (Phase 5 — completes the §12 detail-tab shell). Polymorphic
 * and entity-agnostic, mirroring `features/activity/queries.ts`: one query keyed
 * by `(entityType, entityId)`, company-scoped for tenant isolation. Phase 4 built
 * the `Note` model but no UI; this is the minimal read surface the detail pages
 * consume.
 */

export type NoteEntry = {
  id: string;
  content: string;
  createdAt: Date;
  authorName: string;
};

export async function getNotesForEntity(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
): Promise<NoteEntry[]> {
  const rows = await db.note.findMany({
    where: { organizationId, entityType, entityId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.createdAt,
    authorName: row.createdBy.name,
  }));
}
