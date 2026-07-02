import type { AiUsageLog } from "@prisma/client";

import { db } from "@/lib/db";
import { toDecimal } from "@/lib/money";
import type { RecordAiUsageInput } from "@/features/ai/validation";

/**
 * AiUsageLog repository (§7.2.8, §16) — pure persistence for the AI cost/usage
 * ledger. Organization-scoped. Written on every AI call, including by the
 * default `NullAIProvider` (with `tokensUsed = 0`, `costEstimate = 0`), so a
 * future cost-reporting screen is correct from day one with no "before AI was
 * enabled" gap. `costEstimate` is stored as a `Decimal` (never a float).
 */

/** Record one AI invocation's usage. */
export function recordAiUsage(
  organizationId: string,
  createdById: string,
  input: RecordAiUsageInput,
): Promise<AiUsageLog> {
  return db.aiUsageLog.create({
    data: {
      organizationId,
      createdById,
      feature: input.feature,
      provider: input.provider,
      tokensUsed: input.tokensUsed,
      costEstimate: input.costEstimate === undefined ? undefined : toDecimal(input.costEstimate),
    },
  });
}

/** Recent usage rows for an organization, newest first (optionally since a date). */
export function listAiUsage(
  organizationId: string,
  options: { since?: Date; take?: number } = {},
): Promise<AiUsageLog[]> {
  return db.aiUsageLog.findMany({
    where: {
      organizationId,
      createdAt: options.since ? { gte: options.since } : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: options.take ?? 100,
  });
}

/**
 * Aggregate spend + token totals for an organization over an optional window —
 * backs a future cost-reporting screen. Returns plain serializable values
 * (`costEstimate` as a 4dp string) so it is safe across the server/client boundary.
 */
export async function summarizeAiUsage(
  organizationId: string,
  options: { since?: Date } = {},
): Promise<{ totalTokens: number; totalCost: string; calls: number }> {
  const result = await db.aiUsageLog.aggregate({
    where: {
      organizationId,
      createdAt: options.since ? { gte: options.since } : undefined,
    },
    _sum: { tokensUsed: true, costEstimate: true },
    _count: { _all: true },
  });
  return {
    totalTokens: result._sum.tokensUsed ?? 0,
    totalCost: toDecimal(result._sum.costEstimate ?? 0).toFixed(4),
    calls: result._count._all,
  };
}
