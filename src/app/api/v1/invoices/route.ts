import { InvoiceStatus } from "@prisma/client";

import { requireApiKey } from "@/lib/api/auth";
import { apiHandler } from "@/lib/api/error";
import {
  listResponse,
  parseEnumParam,
  parseListParams,
  parseUuidParam,
} from "@/lib/api/params";
import { serializeInvoice } from "@/lib/api/serializers";
import { db } from "@/lib/db";

/**
 * `GET /api/v1/invoices` (§21.6) — key-authenticated, org-scoped invoice list.
 * Filters: `status`, `customerId`. Offset pagination, page size ≤ 100.
 * Payments are on the detail endpoint, not the list (§23).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = Object.values(InvoiceStatus);

export const GET = apiHandler(async (req) => {
  const { organizationId } = await requireApiKey(req, "invoices:read");
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
    db.invoice.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    db.invoice.count({ where }),
  ]);
  return listResponse(rows.map(serializeInvoice), { page, pageSize, total });
});
