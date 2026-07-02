import { QuoteStatus } from "@prisma/client";

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
import { serializeQuote } from "@/lib/api/serializers";
import { db } from "@/lib/db";
import { quotePayloadSchema } from "@/features/quotes/schema";
import { createQuoteCore } from "@/features/quotes/service";

/**
 * `GET|POST /api/v1/quotes` (§21.6) — key-authenticated, org-scoped.
 * GET filters: `status`, `customerId`; offset pagination, page size ≤ 100;
 * line items are on the detail endpoint, not the list (§23). POST is §21.12's
 * named equivalence surface: it validates against the SAME
 * `quotePayloadSchema` and calls the SAME `createQuoteCore` the staff action
 * uses — totals recomputed server-side, numbering atomic, DRAFT status.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = Object.values(QuoteStatus);

export const GET = apiHandler(async (req) => {
  const { organizationId } = await requireApiKey(req, "quotes:read");
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
    db.quote.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    db.quote.count({ where }),
  ]);
  return listResponse(rows.map(serializeQuote), { page, pageSize, total });
});

export const POST = apiHandler(async (req) => {
  const { organizationId, actorId } = await requireApiKey(req, "quotes:write");
  const data = await parseJsonBody(req, quotePayloadSchema);

  const quote = await createQuoteCore({ organizationId, actorId }, data);
  return createdResponse({ id: quote.id });
});
