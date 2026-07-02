import { CustomerType } from "@prisma/client";

import { requireApiKey } from "@/lib/api/auth";
import { apiHandler } from "@/lib/api/error";
import {
  createdResponse,
  listResponse,
  parseEnumParam,
  parseJsonBody,
  parseListParams,
} from "@/lib/api/params";
import { serializeCustomer } from "@/lib/api/serializers";
import { db } from "@/lib/db";
import { customerSchema } from "@/features/customers/schema";
import { createCustomerCore } from "@/features/customers/service";

/**
 * `GET|POST /api/v1/customers` (§21.6) — key-authenticated, org-scoped.
 * GET filter: `type`; offset pagination, page size ≤ 100. POST validates
 * against the SAME `customerSchema` and calls the SAME `createCustomerCore`
 * the staff action uses — one implementation, two front doors (§21.12).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = Object.values(CustomerType);

export const GET = apiHandler(async (req) => {
  const { organizationId } = await requireApiKey(req, "customers:read");
  const url = new URL(req.url);
  const { page, pageSize, skip } = parseListParams(url);
  const type = parseEnumParam(url, "type", TYPES);

  const where = { organizationId, ...(type && { type }) };
  const [rows, total] = await Promise.all([
    db.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
    db.customer.count({ where }),
  ]);
  return listResponse(rows.map(serializeCustomer), { page, pageSize, total });
});

export const POST = apiHandler(async (req) => {
  const { organizationId, actorId } = await requireApiKey(req, "customers:write");
  const data = await parseJsonBody(req, customerSchema);

  const customer = await createCustomerCore({ organizationId, actorId }, data);
  return createdResponse({ id: customer.id });
});
