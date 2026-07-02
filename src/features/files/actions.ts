"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { requireActiveUser, requireCompanyScope, requireSession } from "@/lib/permissions";
import { logActivity } from "@/features/activity/actions";
import { BusinessRuleError, toActionError } from "@/lib/errors";
import type { ActionResult } from "@/types";
import { attachFileSchema, type AttachFileInput } from "@/features/files/validation";
import { canManageAttachmentTarget, type FileScope } from "@/features/files/access";
import { resolveStorageProvider } from "@/features/files/providers/resolve";
import {
  createFileAttachment,
  deleteFileAttachment,
  getFileAttachmentById,
  renameFileAttachment,
} from "@/features/files/repository";

/**
 * File-attachment write path (§14.6, §14.8, §14.10).
 *
 * Three actions — attach, rename, remove — each guarded by the single
 * authorization gate in `access.ts` (the parent entity's edit permission, plus
 * tenant scope / IDOR), each logging an Activity entry for entity-scoped files,
 * each returning the standard `ActionResult<T>`. The storage provider is resolved
 * through the registry (§6.1): this code never references `UrlPasteProvider` or
 * `VercelBlobProvider` directly, so funding real uploads changes nothing here.
 *
 * Ordering matters for §14.10's "no orphan row" guarantee: `provider.store()`
 * runs *before* the `FileAttachment` insert, so a failed store throws before any
 * row exists, and a failed insert never leaves a half-stored file referenced.
 */

const NO_ACCESS = "You don't have permission to manage files on this record.";

function scopeOf(session: { id: string; organizationId: string; role: FileScope["role"] }): FileScope {
  return { organizationId: session.organizationId, role: session.role, userId: session.id };
}

export async function attachFile(
  input: AttachFileInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireSession();
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = attachFileSchema.parse(input);

    const entityType = data.entityType ?? null;
    const entityId = data.entityId ?? null;

    const allowed = await canManageAttachmentTarget(scopeOf(session), entityType, entityId);
    if (!allowed) {
      throw new BusinessRuleError(NO_ACCESS);
    }

    // Turn the intended attachment into a durable URL via the active provider.
    // For UrlPasteProvider this validates + echoes the pasted URL; for a funded
    // VercelBlobProvider it would upload bytes — same `StoredFile` shape either way.
    const provider = resolveStorageProvider();
    const stored = await provider.store({
      url: data.url,
      fileName: data.fileName,
      mimeType: data.mimeType,
    });

    const attachment = await createFileAttachment(organizationId, session.id, {
      entityType: data.entityType,
      entityId: data.entityId,
      url: stored.url,
      fileName: stored.fileName,
      mimeType: stored.mimeType ?? data.mimeType,
      sizeBytes: stored.sizeBytes ?? data.sizeBytes,
      category: data.category,
    });

    if (entityType && entityId) {
      await logActivity({
        organizationId,
        entityType,
        entityId,
        type: "file_attached",
        message: stored.fileName,
        createdById: session.id,
      });
    }

    revalidatePath("/", "layout");
    return { success: true, data: { id: attachment.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

const renameSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().trim().min(1, "A file needs a name.").max(255),
});

export async function renameAttachment(
  attachmentId: string,
  fileName: string,
): Promise<ActionResult<null>> {
  try {
    const session = await requireSession();
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = renameSchema.parse({ id: attachmentId, fileName });

    const existing = await getFileAttachmentById(organizationId, data.id);
    if (!existing) {
      throw new BusinessRuleError("Attachment not found.");
    }

    const allowed = await canManageAttachmentTarget(
      scopeOf(session),
      existing.entityType,
      existing.entityId,
    );
    if (!allowed) {
      throw new BusinessRuleError(NO_ACCESS);
    }

    await renameFileAttachment(organizationId, data.id, data.fileName);

    if (existing.entityType && existing.entityId) {
      await logActivity({
        organizationId,
        entityType: existing.entityType,
        entityId: existing.entityId,
        type: "file_renamed",
        message: data.fileName,
        createdById: session.id,
      });
    }

    revalidatePath("/", "layout");
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function removeAttachment(
  attachmentId: string,
): Promise<ActionResult<null>> {
  try {
    const session = await requireSession();
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const id = z.string().uuid().parse(attachmentId);

    const existing = await getFileAttachmentById(organizationId, id);
    if (!existing) {
      throw new BusinessRuleError("Attachment not found.");
    }

    const allowed = await canManageAttachmentTarget(
      scopeOf(session),
      existing.entityType,
      existing.entityId,
    );
    if (!allowed) {
      throw new BusinessRuleError(NO_ACCESS);
    }

    await deleteFileAttachment(organizationId, id);

    if (existing.entityType && existing.entityId) {
      await logActivity({
        organizationId,
        entityType: existing.entityType,
        entityId: existing.entityId,
        type: "file_removed",
        message: existing.fileName,
        createdById: session.id,
      });
    }

    revalidatePath("/", "layout");
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
