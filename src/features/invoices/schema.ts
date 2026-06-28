import { z } from "zod";

import { moneyString } from "@/lib/validation";

/**
 * Invoice & Payment validation (Phase 5, §21, §28). An invoice is created against
 * a Job with an explicit amount (deposit / progress / final); its status is never
 * submitted — it is always derived from the Payment sum (§21). Payments are
 * positive money amounts with a method.
 */

export const createInvoiceSchema = z.object({
  jobId: z.string().uuid(),
  amount: moneyString,
  dueDate: z.string().optional().or(z.literal("")),
});

export const PAYMENT_METHODS = ["CASH", "CARD", "BANK", "OTHER"] as const;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: moneyString.refine((v) => Number(v) > 0, { message: "Payment must be greater than 0." }),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(120).optional().or(z.literal("")),
  paidAt: z.string().optional().or(z.literal("")),
});

export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
