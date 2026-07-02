import { JobStatus } from "@prisma/client";

import { requireApiKey } from "@/lib/api/auth";
import { apiHandler } from "@/lib/api/error";
import {
  listResponse,
  parseEnumParam,
  parseListParams,
  parseUuidParam,
} from "@/lib/api/params";
import { serializeJob } from "@/lib/api/serializers";
import { db } from "@/lib/db";

/**
 * `GET /api/v1/jobs` (§21.6) — key-authenticated, org-scoped job list.
 * Filters: `status`, `customerId`. Offset pagination, page size ≤ 100.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = Object.values(JobStatus);

export const GET = apiHandler(async (req) => {
  const { organizationId } = await requireApiKey(req, "jobs:read");
  const url = new URL(req.url);
  const { page, pageSize, skip } = parseListParams(url);
  const status = parseEnumParam(url, "status", STATUSES);
  const customerId = parseUuidParam(url, "customerId");

  const where = {
    organizationId,
    ...(status && { status }),
    ...(customerId && { customerId }),
  };
  const [rows, total] = await Promise.all([
    db.job.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    db.job.count({ where }),
  ]);
  return listResponse(rows.map(serializeJob), { page, pageSize, total });
});
