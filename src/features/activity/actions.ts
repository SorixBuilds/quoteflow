import type { EntityType } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Activity write path (Phase 4, §14). `logActivity()` is the single function
 * permitted to insert an Activity row — referential integrity for the
 * polymorphic `entityId` is enforced here, at the application layer, since no DB
 * foreign key can target multiple tables (§4.2 §31).
 *
 * The caller (a server action) has already authenticated and scoped the request;
 * this low-level writer trusts the `organizationId`/`createdById` it is handed.
 */

export type LogActivityInput = {
  organizationId: string;
  entityType: EntityType;
  entityId: string;
  /** Additive string, never an enum — see §14 event taxonomy. */
  type: string;
  /** Human-readable detail (maps to the `message` column). */
  message?: string;
  createdById: string;
};

export async function logActivity(input: LogActivityInput): Promise<void> {
  await db.activity.create({
    data: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      type: input.type,
      message: input.message ?? null,
      createdById: input.createdById,
    },
  });
}
