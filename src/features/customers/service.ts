import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { logActivity } from "@/features/activity/actions";
import { customerSchema } from "@/features/customers/schema";
import type { z } from "zod";

/**
 * Customer business core (Phase 6B Step 8, §21.6) — the single implementation
 * behind BOTH front doors: the staff server action (`actions.ts`, staff session)
 * and the Public API write handler (`POST/PATCH /api/v1/customers`, API key).
 * Extracted verbatim from the Phase 5 action bodies; behavior is unchanged —
 * same writes, same Activity records, same domain events. The core never reads
 * a session or an API key: the caller resolves an {@link ActorScope} first
 * (§22.1 keeps the auth planes disjoint).
 */

import type { ActorScope } from "@/types";

/** Parsed (OUTPUT) shape of the shared schema — cores receive validated data. */
export type CustomerData = z.output<typeof customerSchema>;

function cleanAddress(
  address: CustomerData["address"],
): Prisma.InputJsonValue | undefined {
  if (!address) return undefined;
  const entries = Object.entries(address).filter(([, v]) => v && String(v).trim() !== "");
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as Prisma.InputJsonValue;
}

/** Create a customer: row + Activity + `customer.created` event. */
export async function createCustomerCore(
  scope: ActorScope,
  data: CustomerData,
): Promise<{ id: string }> {
  const { organizationId, actorId } = scope;

  const customer = await db.customer.create({
    data: {
      organizationId,
      name: data.name,
      type: data.type,
      email: data.email ? data.email : null,
      phone: data.phone ? data.phone : null,
      address: cleanAddress(data.address),
    },
    select: { id: true },
  });

  await logActivity({
    organizationId,
    entityType: "CUSTOMER",
    entityId: customer.id,
    type: "created",
    createdById: actorId,
  });

  emitEvent("customer.created", { organizationId, customerId: customer.id });

  return { id: customer.id };
}

/** Update a customer (org-scoped). Returns false when no owned row matched. */
export async function updateCustomerCore(
  scope: ActorScope,
  id: string,
  data: CustomerData,
): Promise<boolean> {
  const { organizationId } = scope;

  const result = await db.customer.updateMany({
    where: { id, organizationId },
    data: {
      name: data.name,
      type: data.type,
      email: data.email ? data.email : null,
      phone: data.phone ? data.phone : null,
      address: cleanAddress(data.address) ?? Prisma.JsonNull,
    },
  });
  if (result.count === 0) return false;

  emitEvent("customer.updated", { organizationId, customerId: id });
  return true;
}
