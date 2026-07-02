import { requireApiKey } from "@/lib/api/auth";
import { apiHandler } from "@/lib/api/error";
import { itemResponse, notFound, requireUuid } from "@/lib/api/params";
import { serializeJob } from "@/lib/api/serializers";
import { db } from "@/lib/db";

/**
 * `GET /api/v1/jobs/[id]` (§21.6) — one job, only if it belongs to the key's
 * organization. Foreign/absent/malformed ids all 404 identically.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler<{ id: string }>(async (req, context) => {
  const { organizationId } = await requireApiKey(req, "jobs:read");
  const { id } = await context.params;
  requireUuid(id);

  const job = await db.job.findFirst({ where: { id, organizationId } });
  if (!job) throw notFound();
  return itemResponse(serializeJob(job));
});
