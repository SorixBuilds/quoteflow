"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { db } from "@/lib/db";
import { requireActiveUser, requireCompanyScope, requireRole } from "@/lib/permissions";
import { toDecimal } from "@/lib/money";
import { toActionError } from "@/lib/errors";
import { catalogTag } from "@/features/catalog/cache";
import {
  leadSourceSchema,
  serviceCategorySchema,
  serviceSchema,
  taxRateSchema,
  type LeadSourceInput,
  type ServiceCategoryInput,
  type ServiceInput,
  type TaxRateInput,
} from "@/features/catalog/schema";
import type { ActionResult } from "@/types";

/**
 * Catalog write path (Phase 5, §19, §29, §35 rule #7). Every write is OWNER-only
 * — the one place Phase 5 narrows write access below "any non-FIELD", because
 * catalog data drives pricing org-wide. Each write invalidates the
 * `catalog-${organizationId}` cache tag (§38) and revalidates the catalog routes.
 */

/** OWNER gate + scope, shared by every catalog write. Returns the org id. */
async function requireOwnerScope(): Promise<string> {
  await requireRole(["OWNER"]);
  await requireActiveUser();
  const { organizationId } = await requireCompanyScope();
  return organizationId;
}

function invalidate(organizationId: string) {
  revalidateTag(catalogTag(organizationId), { expire: 0 });
  revalidatePath("/catalog", "layout");
}

// --- Service Categories -----------------------------------------------------

export async function createServiceCategory(
  input: ServiceCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await requireOwnerScope();
    const data = serviceCategorySchema.parse(input);
    const created = await db.serviceCategory.create({
      data: { organizationId, name: data.name, sortOrder: data.sortOrder },
      select: { id: true },
    });
    invalidate(organizationId);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function updateServiceCategory(
  id: string,
  input: ServiceCategoryInput,
): Promise<ActionResult<null>> {
  try {
    const organizationId = await requireOwnerScope();
    const data = serviceCategorySchema.parse(input);
    await db.serviceCategory.updateMany({
      where: { id, organizationId },
      data: { name: data.name, sortOrder: data.sortOrder },
    });
    invalidate(organizationId);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

// --- Services ---------------------------------------------------------------

export async function createService(
  input: ServiceInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await requireOwnerScope();
    const data = serviceSchema.parse(input);
    const created = await db.service.create({
      data: {
        organizationId,
        name: data.name,
        description: data.description ? data.description : null,
        sku: data.sku ? data.sku : null,
        categoryId: data.categoryId ? data.categoryId : null,
        unitType: data.unitType,
        price: toDecimal(data.price),
        isActive: data.isActive,
      },
      select: { id: true },
    });
    invalidate(organizationId);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function updateService(
  id: string,
  input: ServiceInput,
): Promise<ActionResult<null>> {
  try {
    const organizationId = await requireOwnerScope();
    const data = serviceSchema.parse(input);
    await db.service.updateMany({
      where: { id, organizationId },
      data: {
        name: data.name,
        description: data.description ? data.description : null,
        sku: data.sku ? data.sku : null,
        categoryId: data.categoryId ? data.categoryId : null,
        unitType: data.unitType,
        price: toDecimal(data.price),
        isActive: data.isActive,
      },
    });
    invalidate(organizationId);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Deactivate/reactivate a service (no destructive delete, §19). */
export async function setServiceActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult<null>> {
  try {
    const organizationId = await requireOwnerScope();
    await db.service.updateMany({
      where: { id, organizationId },
      data: { isActive },
    });
    invalidate(organizationId);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

// --- Tax Rates --------------------------------------------------------------

export async function createTaxRate(
  input: TaxRateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await requireOwnerScope();
    const data = taxRateSchema.parse(input);
    const created = await db.$transaction(async (tx) => {
      // If this rate is the new default, clear the previous default first so the
      // "exactly one default per org" invariant holds (§19) — atomically.
      if (data.isDefault) {
        await tx.taxRate.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.taxRate.create({
        data: {
          organizationId,
          name: data.name,
          rate: toDecimal(data.rate),
          isDefault: data.isDefault,
        },
        select: { id: true },
      });
    });
    invalidate(organizationId);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function updateTaxRate(
  id: string,
  input: TaxRateInput,
): Promise<ActionResult<null>> {
  try {
    const organizationId = await requireOwnerScope();
    const data = taxRateSchema.parse(input);
    await db.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.taxRate.updateMany({
          where: { organizationId, isDefault: true, NOT: { id } },
          data: { isDefault: false },
        });
      }
      await tx.taxRate.updateMany({
        where: { id, organizationId },
        data: { name: data.name, rate: toDecimal(data.rate), isDefault: data.isDefault },
      });
    });
    invalidate(organizationId);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Atomically make exactly one tax rate the org default (§19). */
export async function setDefaultTaxRate(id: string): Promise<ActionResult<null>> {
  try {
    const organizationId = await requireOwnerScope();
    await db.$transaction(async (tx) => {
      await tx.taxRate.updateMany({
        where: { organizationId, isDefault: true, NOT: { id } },
        data: { isDefault: false },
      });
      await tx.taxRate.updateMany({
        where: { id, organizationId },
        data: { isDefault: true },
      });
    });
    invalidate(organizationId);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

// --- Lead Sources -----------------------------------------------------------

export async function createLeadSource(
  input: LeadSourceInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const organizationId = await requireOwnerScope();
    const data = leadSourceSchema.parse(input);
    const created = await db.leadSource.create({
      data: {
        organizationId,
        name: data.name,
        costPerLead: data.costPerLead ? toDecimal(data.costPerLead) : null,
        isActive: data.isActive,
      },
      select: { id: true },
    });
    invalidate(organizationId);
    return { success: true, data: { id: created.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function updateLeadSource(
  id: string,
  input: LeadSourceInput,
): Promise<ActionResult<null>> {
  try {
    const organizationId = await requireOwnerScope();
    const data = leadSourceSchema.parse(input);
    await db.leadSource.updateMany({
      where: { id, organizationId },
      data: {
        name: data.name,
        costPerLead: data.costPerLead ? toDecimal(data.costPerLead) : null,
        isActive: data.isActive,
      },
    });
    invalidate(organizationId);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function setLeadSourceActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult<null>> {
  try {
    const organizationId = await requireOwnerScope();
    await db.leadSource.updateMany({
      where: { id, organizationId },
      data: { isActive },
    });
    invalidate(organizationId);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
