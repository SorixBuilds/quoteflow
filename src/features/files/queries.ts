import type { EntityType } from "@prisma/client";

import { db } from "@/lib/db";
import { isImageUrl } from "@/features/files/types";

/**
 * File-attachment read path (§14.6 `getAttachmentsForEntity`). Polymorphic and
 * entity-agnostic, mirroring `features/notes/queries.ts`: one query keyed by
 * `(entityType, entityId)`, organization-scoped for tenant isolation, newest
 * first. Returns a serializable view (uploader name resolved, `isImage`
 * precomputed) so the detail-page panel is a pure render with no client fetch.
 *
 * Pass `entityType = null` and `entityId = null` to list organization-level
 * "Company documents."
 */

export type AttachmentView = {
  id: string;
  fileName: string;
  url: string;
  category: string;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Best-effort: whether the URL looks directly previewable as an image. */
  isImage: boolean;
  uploadedByName: string;
  createdAt: Date;
};

export async function getAttachmentsForEntity(
  organizationId: string,
  entityType: EntityType | null,
  entityId: string | null,
): Promise<AttachmentView[]> {
  const rows = await db.fileAttachment.findMany({
    where: { organizationId, entityType, entityId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      url: true,
      category: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    url: row.url,
    category: row.category,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    isImage: isImageUrl(row.url) || (row.mimeType?.startsWith("image/") ?? false),
    uploadedByName: row.uploadedBy.name,
    createdAt: row.createdAt,
  }));
}
