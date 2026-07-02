import { requireApiKey } from "@/lib/api/auth";
import { apiHandler } from "@/lib/api/error";
import {
  itemResponse,
  notFound,
  parseJsonBody,
  requireUuid,
} from "@/lib/api/params";
import { serializeCustomer } from "@/lib/api/serializers";
import { db } from "@/lib/db";
import { customerSchema } from "@/features/customers/schema";
import { updateCustomerCore } from "@/features/customers/service";

/**
 * `GET|PATCH /api/v1/customers/[id]` (§21.6) — one customer, only if it
 * belongs to the key's organization. Foreign/absent/malformed ids all 404
 * identically. PATCH takes the full customer shape (the same `customerSchema`
 * the staff form submits) and calls the SAME `updateCustomerCore`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiHandler<{ id: string }>(async (req, context) => {
  const { organizationId } = await requireApiKey(req, "customers:read");
  const { id } = await context.params;
  requireUuid(id);

  const customer = await db.customer.findFirst({ where: { id, organizationId } });
  if (!customer) throw notFound();
  return itemResponse(serializeCustomer(customer));
});

export const PATCH = apiHandler<{ id: string }>(async (req, context) => {
  const { organizationId, actorId } = await requireApiKey(req, "customers:write");
  const { id } = await context.params;
  requireUuid(id);
  const data = await parseJsonBody(req, customerSchema);

  const updated = await updateCustomerCore({ organizationId, actorId }, id, data);
  if (!updated) throw notFound();

  const customer = await db.customer.findFirst({ where: { id, organizationId } });
  if (!customer) throw notFound();
  return itemResponse(serializeCustomer(customer));
});
