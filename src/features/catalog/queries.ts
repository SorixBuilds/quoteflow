import { db } from "@/lib/db";
import { requireCompanyScope, requireRole } from "@/lib/permissions";
import { moneyToString } from "@/lib/money";

/**
 * Catalog read path (Phase 5, §19). Management-screen reads are live (not the
 * cached builder read) so an OWNER sees their edit immediately. All reads are
 * STAFF-or-OWNER (read access, §29) and company-scoped (§39). Decimal columns are
 * serialized to strings for the client list components.
 */

export type ServiceCategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
  serviceCount: number;
};

export async function getServiceCategories(): Promise<ServiceCategoryRow[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();
  const rows = await db.serviceCategory.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      _count: { select: { services: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sortOrder: r.sortOrder,
    serviceCount: r._count.services,
  }));
}

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  unitType: string;
  price: string;
  isActive: boolean;
  categoryId: string | null;
  categoryName: string | null;
};

export async function getServices(): Promise<ServiceRow[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();
  const rows = await db.service.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      sku: true,
      unitType: true,
      price: true,
      isActive: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    sku: r.sku,
    unitType: r.unitType,
    price: moneyToString(r.price),
    isActive: r.isActive,
    categoryId: r.categoryId,
    categoryName: r.category?.name ?? null,
  }));
}

export type TaxRateRow = {
  id: string;
  name: string;
  rate: string;
  isDefault: boolean;
};

export async function getTaxRates(): Promise<TaxRateRow[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();
  const rows = await db.taxRate.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, rate: true, isDefault: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    rate: moneyToString(r.rate),
    isDefault: r.isDefault,
  }));
}

export type LeadSourceRow = {
  id: string;
  name: string;
  costPerLead: string | null;
  isActive: boolean;
};

export async function getLeadSources(): Promise<LeadSourceRow[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();
  const rows = await db.leadSource.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, costPerLead: true, isActive: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    costPerLead: r.costPerLead ? moneyToString(r.costPerLead) : null,
    isActive: r.isActive,
  }));
}

/** Category options for the Service form's select. */
export async function getCategoryOptions(): Promise<{ id: string; name: string }[]> {
  await requireRole(["OWNER", "STAFF"]);
  const { organizationId } = await requireCompanyScope();
  return db.serviceCategory.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
