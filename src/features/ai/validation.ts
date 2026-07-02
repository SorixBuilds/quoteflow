import { z } from "zod";

/**
 * AI usage-log validation (§7.2.8, §16). `feature` and `provider` are free-text
 * (open taxonomy — new AI features are additional `feature` values, not new
 * tables, per §16.13). `costEstimate` is validated as a decimal *string* — never
 * a JS float — consistent with the frozen money discipline (§5); the repository
 * converts it to a Prisma `Decimal`.
 */

const DECIMAL_PATTERN = /^\d{1,6}(\.\d{1,4})?$/;

export const recordAiUsageSchema = z.object({
  feature: z.string().trim().min(1).max(60),
  provider: z.string().trim().min(1).max(40),
  tokensUsed: z.number().int().nonnegative().optional(),
  /** Up to 4 decimal places (matches `@db.Decimal(10, 4)`), as a string. */
  costEstimate: z
    .string()
    .trim()
    .regex(DECIMAL_PATTERN, "Enter a valid cost, e.g. 0.0123")
    .optional(),
});

export type RecordAiUsageInput = z.infer<typeof recordAiUsageSchema>;
