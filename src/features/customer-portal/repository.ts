import type { PortalAccessToken } from "@prisma/client";

import { db } from "@/lib/db";
import { generatePortalToken } from "@/features/customer-portal/token";
import type { IssuePortalTokenInput } from "@/features/customer-portal/validation";

/**
 * PortalAccessToken repository (§7.2.7, §12) — pure persistence for the Customer
 * Portal's stored, revocable access tokens. Only the bcrypt `tokenHash` is
 * stored; the plaintext is returned once from {@link issuePortalToken}. This
 * coexists with — and never touches — the frozen Phase 5 per-Quote HMAC share
 * link (`lib/tokens.ts`).
 *
 * Organization-scoped on the management/listing side. Redemption (a later step)
 * verifies a presented token by bcrypt-comparing it against the redeemable
 * candidates from {@link listRedeemableTokens}; because a bcrypt hash is not
 * reversible or directly queryable, candidate narrowing happens in the
 * redemption workflow, not here.
 */

/** A newly issued token row plus its one-time plaintext. */
export type IssuedPortalToken = {
  record: PortalAccessToken;
  /** Embed in the `/portal/login?token=...` link; unrecoverable afterward. */
  plaintext: string;
};

/** Issue a portal token for a customer, returning the one-time plaintext. */
export async function issuePortalToken(
  organizationId: string,
  createdById: string,
  input: IssuePortalTokenInput,
): Promise<IssuedPortalToken> {
  const { plaintext, tokenHash } = await generatePortalToken();
  const record = await db.portalAccessToken.create({
    data: {
      organizationId,
      createdById,
      customerId: input.customerId,
      tokenHash,
      label: input.label,
      expiresAt: input.expiresAt,
    },
  });
  return { record, plaintext };
}

/** All tokens issued for a customer (management view), newest first, org-scoped. */
export function listPortalTokensForCustomer(
  organizationId: string,
  customerId: string,
): Promise<PortalAccessToken[]> {
  return db.portalAccessToken.findMany({
    where: { organizationId, customerId },
    orderBy: { createdAt: "desc" },
  });
}

/** A single token row, org-scoped. */
export function getPortalTokenById(
  organizationId: string,
  id: string,
): Promise<PortalAccessToken | null> {
  return db.portalAccessToken.findFirst({ where: { id, organizationId } });
}

/**
 * Currently redeemable tokens (not revoked, not expired) — the candidate set the
 * redemption step bcrypt-compares a presented token against. Kept narrow by the
 * `revokedAt`/`expiresAt` filters.
 */
export function listRedeemableTokens(now: Date = new Date()): Promise<PortalAccessToken[]> {
  return db.portalAccessToken.findMany({
    where: {
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  });
}

/** Mark a token used (called on successful redemption). */
export function markPortalTokenUsed(id: string): Promise<PortalAccessToken> {
  return db.portalAccessToken.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
}

/** Revoke a token, org-scoped. Idempotent. */
export async function revokePortalToken(
  organizationId: string,
  id: string,
): Promise<boolean> {
  const result = await db.portalAccessToken.updateMany({
    where: { id, organizationId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}
