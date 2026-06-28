import { z } from "zod";

/**
 * Customer validation (Phase 5, §15, §28). Address is a small structured
 * sub-form serialized to the single `Json` column (the frozen schema's
 * deliberate no-billing/shipping-split choice). Email/phone are optional; one of
 * them is encouraged but not required (walk-in customers may have neither yet).
 */

export const addressSchema = z.object({
  street: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  state: z.string().trim().max(120).optional().or(z.literal("")),
  postal: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().max(120).optional().or(z.literal("")),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, "A customer name is required.").max(200),
  type: z.enum(["INDIVIDUAL", "BUSINESS"]),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: addressSchema.optional(),
});

export type CustomerInput = z.input<typeof customerSchema>;
export type AddressInput = z.input<typeof addressSchema>;
