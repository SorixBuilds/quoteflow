"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireActiveUser, requireCompanyScope, requireRole } from "@/lib/permissions";
import { toActionError } from "@/lib/errors";
import { customerSchema, type CustomerInput } from "@/features/customers/schema";
import { createCustomerCore, updateCustomerCore } from "@/features/customers/service";
import type { ActionResult } from "@/types";

/**
 * Customer write path (Phase 5, §15, §29). OWNER/STAFF only; company-scoped.
 * Since Phase 6B Step 8 the business core lives in `service.ts` and is shared
 * verbatim with the Public API's write handlers (§21.6) — this file is the
 * staff-session front door: authenticate, validate, call the core, revalidate.
 */

export async function createCustomer(
  input: CustomerInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = customerSchema.parse(input);

    const customer = await createCustomerCore(
      { organizationId, actorId: session.id },
      data,
    );

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

    const updated = await updateCustomerCore(
      { organizationId, actorId: session.id },
      id,
      data,
    );
    if (!updated) {
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
