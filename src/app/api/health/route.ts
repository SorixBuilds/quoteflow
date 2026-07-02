import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Health check (Phase 6B Step 11 — deployment/DR validation, §22/§24).
 *
 * `GET /api/health` — an unauthenticated liveness+readiness probe for the
 * deployment platform and uptime monitors. It confirms the process is up and
 * the database is reachable (a trivial `SELECT 1`), returning 200 when healthy
 * and 503 when the DB check fails, so a load balancer or cron monitor can act
 * on it. It exposes NO tenant data and NO internal detail — only a coarse
 * `ok`/`error` per check — so it is safe to leave public (it is added to the
 * public route set, never behind the staff/portal/API auth planes).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let database: "ok" | "error" = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    database = "error";
    // Log server-side for diagnosis; the response stays opaque.
    logger.error("Health check: database unreachable", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const healthy = database === "ok";
  return Response.json(
    {
      status: healthy ? "healthy" : "unhealthy",
      checks: { database },
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
