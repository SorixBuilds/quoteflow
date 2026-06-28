import { z } from "zod";

import { moneyString, optionalMoneyString, percentString } from "@/lib/validation";

/**
 * Catalog validation schemas (Phase 5, §19, §28). One schema per write action,
 * shared between the client form and the server action. Money/percent fields are
 * decimal strings (§28) converted to `Decimal` server-side.
 */

export const serviceCategorySchema = z.object({
  name: z.string().trim().min(1, "A category name is required.").max(120),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const UNIT_TYPES = ["HOUR", "FLAT", "UNIT", "CUSTOM"] as const;

export const serviceSchema = z.object({
  name: z.string().trim().min(1, "A service name is required.").max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  unitType: z.enum(UNIT_TYPES),
  price: moneyString,
  isActive: z.boolean().default(true),
});

export const taxRateSchema = z.object({
  name: z.string().trim().min(1, "A tax rate name is required.").max(120),
  rate: percentString,
  isDefault: z.boolean().default(false),
});

export const leadSourceSchema = z.object({
  name: z.string().trim().min(1, "A lead source name is required.").max(120),
  costPerLead: optionalMoneyString,
  isActive: z.boolean().default(true),
});

export type ServiceCategoryInput = z.input<typeof serviceCategorySchema>;
export type ServiceInput = z.input<typeof serviceSchema>;
export type TaxRateInput = z.input<typeof taxRateSchema>;
export type LeadSourceInput = z.input<typeof leadSourceSchema>;
