"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireActiveUser, requireRole } from "@/lib/permissions";
import { toActionError } from "@/lib/errors";
import { logActivity } from "@/features/activity/actions";
import {
  createApiKey,
  findApiKeyById,
  revokeApiKey,
} from "@/features/api-keys/repository";
import {
  createApiKeySchema,
  type CreateApiKeyInput,
} from "@/features/api-keys/validation";
import { isApiScope } from "@/features/api-keys/key";
import type { ActionResult } from "@/types";

/**
 * API-key management actions (Phase 6B Step 7, §21.5, §21.8) — the staff-plane
 * side of the Public API. OWNER-only (a key is delegated org-wide access, the
 * strongest grant the Settings area hands out). These run under the staff
 * session and never under `requireApiKey()` — the two planes stay disjoint
 * (§22.1); this module is the deliberate management bridge, exactly like the
 * portal's `staff-actions.ts`.
 *
 * The full key appears exactly once, in the return value of {@link createKey} /
 * {@link rotateKey} — never persisted, never logged (§21.9, §22.2).
 */

const SETTINGS_PATH = "/settings/api-keys";

export type CreatedKeyResult = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  /** The full key — shown once, unrecoverable afterwards. */
  plaintext: string;
};

/** Mint a new API key with an explicit, least-privilege scope set. */
export async function createKey(
  input: CreateApiKeyInput,
): Promise<ActionResult<CreatedKeyResult>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();
    const data = createApiKeySchema.parse(input);

    const { record, plaintext } = await createApiKey(session.organizationId, session.id, data);

    await logActivity({
      organizationId: session.organizationId,
      entityType: "ORGANIZATION",
      entityId: session.organizationId,
      type: "api_key_created",
      message: record.name,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    return {
      success: true,
      data: {
        id: record.id,
        name: record.name,
        keyPrefix: record.keyPrefix,
        scopes: record.scopes,
        plaintext,
      },
    };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Revoke a key immediately (org-scoped, idempotent, §21.9). */
export async function revokeKey(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();

    const key = await findApiKeyById(session.organizationId, id);
    if (!key) return { success: false, error: "API key not found." };

    const revoked = await revokeApiKey(session.organizationId, id);
    if (!revoked) return { success: false, error: "This key is already revoked." };

    await logActivity({
      organizationId: session.organizationId,
      entityType: "ORGANIZATION",
      entityId: session.organizationId,
      type: "api_key_revoked",
      message: key.name,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: { id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/**
 * Rotate a key: mint a replacement with the same name and scopes, then revoke
 * the old one. Composed entirely of the two approved operations (create +
 * revoke) so rotation introduces no new credential mechanics. The old key stops
 * working the moment this returns; the new plaintext is shown once.
 */
export async function rotateKey(id: string): Promise<ActionResult<CreatedKeyResult>> {
  try {
    const session = await requireRole(["OWNER"]);
    await requireActiveUser();

    const existing = await findApiKeyById(session.organizationId, id);
    if (!existing || !existing.isActive || existing.revokedAt) {
      return { success: false, error: "Only an active key can be rotated." };
    }

    // Stored scopes re-narrowed through the closed-set guard (defense in depth).
    const scopes = existing.scopes.filter(isApiScope);
    const data = createApiKeySchema.parse({ name: existing.name, scopes });

    const { record, plaintext } = await createApiKey(session.organizationId, session.id, data);
    await revokeApiKey(session.organizationId, id);

    await logActivity({
      organizationId: session.organizationId,
      entityType: "ORGANIZATION",
      entityId: session.organizationId,
      type: "api_key_rotated",
      message: existing.name,
      createdById: session.id,
    });

    revalidatePath(SETTINGS_PATH);
    return {
      success: true,
      data: {
        id: record.id,
        name: record.name,
        keyPrefix: record.keyPrefix,
        scopes: record.scopes,
        plaintext,
      },
    };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
