import type { EntityType } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Activity read path (Phase 4, §14). One query function for every entity's
 * timeline — `getActivityForEntity` is called with the entity's own
 * `entityType` (`"LEAD"`, `"QUOTE"`, `"JOB"`, …) from day one of Phase 5; no
 * per-entity bespoke query is ever written.
 *
 * Company-scoped: `organizationId` is part of the `where` (tenant isolation,
 * §22) in addition to the polymorphic `(entityType, entityId)` pair the spec's
 * signature names. Reverse-chronological, paginated past 50 by default.
 */

export type ActivityEntry = {
  id: string;
  type: string;
  message: string | null;
  createdAt: Date;
  actorName: string;
};

export async function getActivityForEntity(
  organizationId: string,
  entityType: EntityType,
  entityId: string,
  options?: { take?: number; skip?: number },
): Promise<ActivityEntry[]> {
  const rows = await db.activity.findMany({
    where: { organizationId, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: options?.take ?? 50,
    skip: options?.skip ?? 0,
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    createdAt: row.createdAt,
    actorName: row.createdBy.name,
  }));
}

export type OrgActivityEntry = ActivityEntry & {
  entityType: EntityType;
  entityId: string;
};

/**
 * Org-wide recent activity feed (Phase 5, §33). The one Activity query Phase 4
 * did not need — Phase 4 had no entities to show activity *across*. Additive:
 * the per-entity query above is unchanged. Company-scoped; reverse-chronological.
 */
export async function getRecentActivityForOrganization(
  organizationId: string,
  limit = 15,
): Promise<OrgActivityEntry[]> {
  const rows = await db.activity.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      message: true,
      createdAt: true,
      entityType: true,
      entityId: true,
      createdBy: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    message: row.message,
    createdAt: row.createdAt,
    actorName: row.createdBy.name,
    entityType: row.entityType,
    entityId: row.entityId,
  }));
}
