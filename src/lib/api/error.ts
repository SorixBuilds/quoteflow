import { BusinessRuleError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Public API error surface (Phase 6B Step 7, §21.10).
 *
 * One standardized envelope — `{ error: { code, message } }` with conventional
 * HTTP status codes (401/403/404/422/429/500) — produced in exactly one place.
 * Every `/api/v1/*` handler throws a typed {@link ApiError} and is wrapped by
 * {@link apiHandler}, so no handler hand-rolls its own error shape and no
 * internal error detail (Prisma message, stack) can leak to a third-party
 * caller.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
    /** For 429s — surfaced as a `Retry-After` header (§21.11). */
    readonly retryAfterSeconds?: number,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

/** The §21.10 envelope for a typed error, with `Retry-After` when applicable. */
export function errorResponse(error: ApiError): Response {
  const headers: Record<string, string> = {};
  if (error.retryAfterSeconds !== undefined) {
    headers["Retry-After"] = String(error.retryAfterSeconds);
  }
  return Response.json(
    { error: { code: error.code, message: error.message } },
    { status: error.status, headers },
  );
}

type RouteContext<P> = { params: Promise<P> };
type RouteHandler<P> = (req: Request, context: RouteContext<P>) => Promise<Response>;

/**
 * The single shared wrapper every `/api/v1/*` handler exports through (§21.10).
 * A thrown {@link ApiError} becomes its envelope; anything else is logged
 * server-side and becomes an opaque 500 — the API analog of `toActionError`'s
 * "no raw error reaches the client" rule.
 */
export function apiHandler<P = unknown>(fn: RouteHandler<P>): RouteHandler<P> {
  return async (req, context) => {
    try {
      return await fn(req, context);
    } catch (error) {
      if (error instanceof ApiError) {
        // 4xx are caller mistakes (audit signal, not an incident); 5xx are ours.
        const log = error.status >= 500 ? logger.error : logger.warn;
        log("api.error", {
          status: error.status,
          code: error.code,
          method: req.method,
          path: new URL(req.url).pathname,
        });
        return errorResponse(error);
      }
      // A curated business-rule violation from a shared core is caller-safe by
      // definition (§36) — surfaced verbatim as a 422, same as the staff UI.
      if (error instanceof BusinessRuleError) {
        return errorResponse(new ApiError(422, "business_rule_violation", error.message));
      }
      logger.error("Unhandled API error", {
        method: req.method,
        path: new URL(req.url).pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      return errorResponse(new ApiError(500, "internal_error", "Something went wrong."));
    }
  };
}
