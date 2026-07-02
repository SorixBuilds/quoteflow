import type { ApiKey } from "@prisma/client";

import { db } from "@/lib/db";
import { generateApiKey, prefixOf } from "@/features/api-keys/key";
import type { CreateApiKeyInput } from "@/features/api-keys/validation";

/**
 * ApiKey repository (§7.2.3, §21) — pure persistence for the Public API's
 * authentication credential. Only the bcrypt hash and the indexable prefix are
 * stored; the full key is returned exactly once from {@link createApiKey} and
 * never persisted (§21.9).
 *
 * Most functions are organization-scoped. The one deliberate exception is
 * {@link findActiveKeyCandidatesByPrefix}, the authentication narrowing step:
 * it runs *before* the caller's organization is known (the key itself
 * establishes the tenant), so it is keyed by the indexed `keyPrefix` instead.
 * This matches the authoritative §21.6 flow exactly.
 */

/** A newly minted key row plus the one-time plaintext to show the user. */
export type CreatedApiKey = {
  record: Omit<ApiKey, "hashedKey">;
  /** Full key — surface to the user once, then it is unrecoverable. */
  plaintext: string;
};

/** Mint and persist a new API key, returning the one-time plaintext. */
export async function createApiKey(
  organizationId: string,
  createdById: string,
  input: CreateApiKeyInput,
): Promise<CreatedApiKey> {
  const { plaintext, keyPrefix, hashedKey } = await generateApiKey();
  const record = await db.apiKey.create({
    data: {
      organizationId,
      createdById,
      name: input.name,
      scopes: input.scopes,
      keyPrefix,
      hashedKey,
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      isActive: true,
      createdById: true,
      createdAt: true,
      revokedAt: true,
    },
  });
  return { record, plaintext };
}

/** All keys for an organization (management screen), newest first, hash omitted. */
export function listApiKeys(
  organizationId: string,
): Promise<Omit<ApiKey, "hashedKey">[]> {
  return db.apiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      organizationId: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      isActive: true,
      createdById: true,
      createdAt: true,
      revokedAt: true,
    },
  });
}

/**
 * Authentication narrowing step (§21.6): active candidate keys sharing the
 * presented key's prefix. NOT organization-scoped by design — the key being
 * verified is what establishes the organization. The caller bcrypt-compares the
 * raw key against each candidate's `hashedKey` (constant-time) and, on a match,
 * reads `organizationId`/`scopes` from the row.
 */
export function findActiveKeyCandidatesByPrefix(rawKey: string): Promise<ApiKey[]> {
  return db.apiKey.findMany({
    where: { keyPrefix: prefixOf(rawKey), isActive: true, revokedAt: null },
  });
}

/** One key by id, org-scoped (rotation/revocation lookups), hash omitted. */
export function findApiKeyById(
  organizationId: string,
  id: string,
): Promise<Omit<ApiKey, "hashedKey"> | null> {
  return db.apiKey.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      isActive: true,
      createdById: true,
      createdAt: true,
      revokedAt: true,
    },
  });
}

/** Record successful use (best-effort; callers should not block the response on it). */
export function touchApiKeyLastUsed(id: string): Promise<unknown> {
  return db.apiKey.update({ where: { id }, data: { lastUsedAt: new Date() } });
}

/** Revoke a key (org-scoped). Idempotent: a no-op if already revoked/foreign. */
export async function revokeApiKey(organizationId: string, id: string): Promise<boolean> {
  const result = await db.apiKey.updateMany({
    where: { id, organizationId, revokedAt: null },
    data: { isActive: false, revokedAt: new Date() },
  });
  return result.count > 0;
}
