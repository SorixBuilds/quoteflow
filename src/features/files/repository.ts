import type { EntityType, FileAttachment } from "@prisma/client";

import { db } from "@/lib/db";
import type { AttachFileInput } from "@/features/files/validation";

/**
 * FileAttachment repository (§7.2.2, §14) — polymorphic attachments. Pure
 * persistence, organization-scoped via an `organizationId` argument. `entityType`
 * null = an organization-level file (mirrors Task's nullable polymorphic shape).
 * `entityId` is intentionally not a DB-enforced FK (the already-accepted frozen
 * trade-off); callers pass an id they have already scoped.
 */

/** Persist a new attachment, attributing it to the uploading user. */
export function createFileAttachment(
  organizationId: string,
  uploadedById: string,
  input: AttachFileInput,
): Promise<FileAttachment> {
  return db.fileAttachment.create({
    data: {
      organizationId,
      uploadedById,
      entityType: input.entityType,
      entityId: input.entityId,
      url: input.url,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      category: input.category,
    },
  });
}

/** A single attachment, org-scoped. */
export function getFileAttachmentById(
  organizationId: string,
  id: string,
): Promise<FileAttachment | null> {
  return db.fileAttachment.findFirst({ where: { id, organizationId } });
}

/**
 * Attachments for one entity, newest first. Pass `entityType: null` (and
 * `entityId: null`) to list organization-level files.
 */
export function listAttachmentsForEntity(
  organizationId: string,
  entityType: EntityType | null,
  entityId: string | null,
): Promise<FileAttachment[]> {
  return db.fileAttachment.findMany({
    where: { organizationId, entityType, entityId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Rename an attachment's display `fileName`, org-scoped. Updates only the label —
 * the stored `url` and every other column are untouched (a rename never re-stores
 * bytes). Returns the count actually updated so a cross-tenant id is a no-op.
 */
export async function renameFileAttachment(
  organizationId: string,
  id: string,
  fileName: string,
): Promise<boolean> {
  const result = await db.fileAttachment.updateMany({
    where: { id, organizationId },
    data: { fileName },
  });
  return result.count > 0;
}

/** Remove an attachment, org-scoped (returns the count actually deleted). */
export async function deleteFileAttachment(
  organizationId: string,
  id: string,
): Promise<boolean> {
  const result = await db.fileAttachment.deleteMany({ where: { id, organizationId } });
  return result.count > 0;
}
