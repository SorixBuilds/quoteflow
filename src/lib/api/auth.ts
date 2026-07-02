import "server-only";

import { verifyApiKey, type ApiScope } from "@/features/api-keys/key";
import {
  findActiveKeyCandidatesByPrefix,
  touchApiKeyLastUsed,
} from "@/features/api-keys/repository";
import { ApiError } from "@/lib/api/error";
import { logger } from "@/lib/logger";
import { resolveRateLimiter } from "@/lib/rate-limit/resolve";

/**
 * `requireApiKey()` — the Public API's analog to `requireSession()` (§21.6) and
 * the third, fully isolated authentication plane (§22.1). It must NEVER be
 * imported outside `app/api/v1/*`: an API key can reach no UI route or server
 * action, and no staff/portal code path can authenticate as an API caller. That
 * boundary is CI-enforced by the import-boundary test, exactly like the
 * portal's.
 *
 * Flow, per the authoritative §21.6 sketch: bearer header → indexed
 * `keyPrefix` narrowing → constant-time bcrypt compare over the candidate set →
 * scope check (§21.8) → per-key rate limit (§21.11) → `lastUsedAt` touch
 * (§21.14's usage signal). Failures are generic — an invalid key and a revoked
 * key produce the same 401 body, the §12.10 "no enumeration" rule extended to
 * key validation (§22.5).
 */

export type ApiKeyContext = {
  /** The authenticated key's id — the rate-limit and usage-log identity. */
  keyId: string;
  /** The tenant this key belongs to — constrains every query the handler runs. */
  organizationId: string;
  /** Every scope the key was granted (the required one is already verified). */
  scopes: string[];
  /**
   * The `User` who minted the key — the actor write endpoints attribute
   * Activity and side effects to (§21.6: the caller identity comes from the
   * key instead of a session; a machine caller acts on behalf of the OWNER
   * who delegated it access).
   */
  actorId: string;
};

export async function requireApiKey(
  req: Request,
  requiredScope: ApiScope,
): Promise<ApiKeyContext> {
  const header = req.headers.get("authorization");
  const raw = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!raw) {
    throw new ApiError(
      401,
      "missing_api_key",
      "Provide an API key via the Authorization header: Bearer <key>.",
    );
  }

  // Indexed narrowing first (§21.9): only keys sharing the presented prefix are
  // bcrypt-compared. Revoked/disabled keys are excluded by the query itself, so
  // they fail with the same generic 401 as a key that never existed.
  const candidates = await findActiveKeyCandidatesByPrefix(raw);
  let match: (typeof candidates)[number] | undefined;
  for (const candidate of candidates) {
    if (await verifyApiKey(raw, candidate.hashedKey)) {
      match = candidate;
      break;
    }
  }
  if (!match) {
    throw new ApiError(401, "invalid_api_key", "This API key is not valid.");
  }

  if (!match.scopes.includes(requiredScope)) {
    throw new ApiError(
      403,
      "insufficient_scope",
      `This API key does not have the required scope: ${requiredScope}.`,
    );
  }

  const limit = await resolveRateLimiter().checkLimit(match.id);
  if (!limit.allowed) {
    throw new ApiError(
      429,
      "rate_limited",
      "Rate limit exceeded. Retry after the indicated delay.",
      limit.retryAfterSeconds,
    );
  }

  // Usage signals: `lastUsedAt` drives the §21.14 deprecation-by-evidence
  // policy; the structured line is the per-request audit/usage log (§22).
  await touchApiKeyLastUsed(match.id);
  logger.info("api.request", {
    keyId: match.id,
    organizationId: match.organizationId,
    method: req.method,
    path: new URL(req.url).pathname,
    scope: requiredScope,
  });

  return {
    keyId: match.id,
    organizationId: match.organizationId,
    scopes: match.scopes,
    actorId: match.createdById,
  };
}
