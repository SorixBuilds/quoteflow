import { z } from "zod";

import { moneyString, quantityString } from "@/lib/validation";

/**
 * Quote validation (Phase 5, §16, §17, §28). The client submits only the inputs
 * the server needs to derive totals — line items, the optional quote-level
 * discount, dates, notes — never a `subtotal`/`tax`/`total` (those are computed
 * server-side by `calculations.ts`, §5). Money/quantity fields are decimal
 * strings (§28).
 */

export const quoteItemInputSchema = z.object({
  serviceId: z.string().uuid().optional().or(z.literal("")).or(z.null()),
  description: z.string().trim().min(1, "Each line needs a description.").max(500),
  quantity: quantityString,
  unitPrice: moneyString,
  taxRateId: z.string().uuid().optional().or(z.literal("")).or(z.null()),
});

export const quotePayloadSchema = z
  .object({
    customerId: z.string().uuid("A customer is required."),
    leadId: z.string().uuid().optional().or(z.literal("")).or(z.null()),
    items: z.array(quoteItemInputSchema).min(1, "Add at least one line item."),
    discountType: z.enum(["PERCENT", "FIXED"]).optional().or(z.literal("")).or(z.null()),
    discountValue: moneyString.optional().or(z.literal("")).or(z.null()),
    notes: z.string().trim().max(5000).optional().or(z.literal("")),
    terms: z.string().trim().max(5000).optional().or(z.literal("")),
    issueDate: z.string().optional().or(z.literal("")),
    expiryDate: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const hasType = Boolean(data.discountType);
    const hasValue = Boolean(data.discountValue);
    if (hasType && !hasValue) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Enter a discount amount." });
    }
    if (hasValue && !hasType) {
      ctx.addIssue({ code: "custom", path: ["discountType"], message: "Choose a discount type." });
    }
  });

export type QuoteItemInput = z.input<typeof quoteItemInputSchema>;
export type QuotePayload = z.input<typeof quotePayloadSchema>;
