import { LeadStatus } from "@prisma/client";

import { requireApiKey } from "@/lib/api/auth";
import { apiHandler } from "@/lib/api/error";
import {
  createdResponse,
  listResponse,
  parseEnumParam,
  parseJsonBody,
  parseListParams,
  parseUuidParam,
} from "@/lib/api/params";
import { serializeLead } from "@/lib/api/serializers";
import { db } from "@/lib/db";
import { leadSchema } from "@/features/leads/schema";
import { createLeadCore } from "@/features/leads/service";

/**
 * `GET|POST /api/v1/leads` (§21.6) — key-authenticated, org-scoped.
 * GET filters: `status`, `customerId`; offset pagination, page size ≤ 100.
 * POST validates against the SAME `leadSchema` and calls the SAME
 * `createLeadCore` the staff action uses (§21.12).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = Object.values(LeadStatus);

export const GET = apiHandler(async (req) => {
  const { organizationId } = await requireApiKey(req, "leads:read");
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
    db.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    db.lead.count({ where }),
  ]);
  return listResponse(rows.map(serializeLead), { page, pageSize, total });
});

export const POST = apiHandler(async (req) => {
  const { organizationId, actorId } = await requireApiKey(req, "leads:write");
  const data = await parseJsonBody(req, leadSchema);

  const lead = await createLeadCore({ organizationId, actorId }, data);
  return createdResponse({ id: lead.id });
});
