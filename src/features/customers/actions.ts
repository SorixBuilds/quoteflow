"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireActiveUser, requireCompanyScope, requireRole } from "@/lib/permissions";
import { logActivity } from "@/features/activity/actions";
import { toActionError } from "@/lib/errors";
import { customerSchema, type CustomerInput } from "@/features/customers/schema";
import type { ActionResult } from "@/types";

/**
 * Customer write path (Phase 5, §15, §29). OWNER/STAFF only; company-scoped.
 * Creating/updating logs an Activity entry on the customer's polymorphic
 * timeline. Address is serialized to the single `Json` column.
 */

function cleanAddress(
  address: CustomerInput["address"],
): Prisma.InputJsonValue | undefined {
  if (!address) return undefined;
  const entries = Object.entries(address).filter(([, v]) => v && String(v).trim() !== "");
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as Prisma.InputJsonValue;
}

export async function createCustomer(
  input: CustomerInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = customerSchema.parse(input);

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
      createdById: session.id,
    });

    revalidatePath("/customers");
    return { success: true, data: { id: customer.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
): Promise<ActionResult<null>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = customerSchema.parse(input);

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
    if (result.count === 0) {
      return { success: false, error: "Customer not found." };
    }

    revalidatePath(`/customers/${id}`);
    revalidatePath("/customers");
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
