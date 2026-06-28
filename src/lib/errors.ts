import { Prisma } from "@prisma/client";
import { z } from "zod";

import { logger } from "@/lib/logger";
import type { ActionResult } from "@/types";

/**
 * Shared server-action error mapping (Phase 5, §36). Every business action wraps
 * its body in `try { … } catch (error) { unstable_rethrow(error); return
 * toActionError(error); }`. This:
 *   - lets Next.js redirect/notFound control-flow errors propagate (the caller
 *     must `unstable_rethrow` first),
 *   - maps Prisma `P2025` (a conditional status-transition update that matched no
 *     row) to the §22/§36 "changed by someone else" message,
 *   - maps Zod issues to their first human-readable message,
 *   - logs the real error server-side and returns a safe generic string for
 *     anything else — no raw Prisma error reaches the client.
 */

export const STALE_TRANSITION_MESSAGE =
  "This record was changed by someone else — refresh and try again.";

export function toActionError<T = never>(error: unknown): ActionResult<T> {
  if (error instanceof z.ZodError) {
    return {
      success: false,
      error: error.issues[0]?.message ?? "Please check the highlighted fields.",
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return { success: false, error: STALE_TRANSITION_MESSAGE };
    }
    if (error.code === "P2002") {
      return {
        success: false,
        error: "That value is already in use. Please choose another.",
      };
    }
    logger.error("Prisma error in server action", {
      code: error.code,
      meta: error.meta,
    });
    return { success: false, error: "Something went wrong. Please try again." };
  }

  // Only a curated business-rule error (raised intentionally by an action for a
  // known rule violation) is surfaced verbatim. Every other Error is logged and
  // replaced with a generic message so no internal detail leaks.
  if (error instanceof BusinessRuleError) {
    return { success: false, error: error.message };
  }

  logger.error("Unhandled error in server action", {
    error: error instanceof Error ? error.message : String(error),
  });
  return { success: false, error: "Something went wrong. Please try again." };
}

/** A curated business-rule error the action raises on purpose (§36). */
export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessRuleError";
  }
}
