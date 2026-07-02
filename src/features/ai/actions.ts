"use server";

import { unstable_rethrow } from "next/navigation";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/config/flags";
import {
  requireActiveUser,
  requireCompanyScope,
  requireSession,
} from "@/lib/permissions";
import { resolveAiProvider } from "@/features/ai/providers/resolve";
import { recordAiUsage } from "@/features/ai/repository";
import {
  buildJobSummaryPrompt,
  buildQuotePrompt,
} from "@/features/ai/prompts";
import type { AIProvider } from "@/features/ai/providers/types";
import type { ActionResult } from "@/types";

/**
 * AI-assisted suggestion actions (Phase 6B Step 9, §16.6–16.10).
 *
 * Every action follows the exact §16.7 flow: feature-flag check (`ai`, the
 * canonical Phase 4 flag name for the document's `aiEnabled`) → pre-scoped
 * entity load → `AIProvider.complete()` → `AiUsageLog` write → suggestion
 * string returned. The suggestion is only ever a *proposal*: the staff member
 * accepts it into an existing field and the existing, validated save action
 * persists it — the AI layer never writes a business field itself (§16.6).
 *
 * Staff-plane only (§16.9): no portal or Public API caller can reach these.
 * Permissions ride the underlying entity exactly (§16.8): quote drafting is
 * OWNER/STAFF (who can edit quotes); job summaries additionally allow FIELD
 * for their own assigned job. Provider failures surface as a calm "unavailable
 * right now" — never blocking the underlying save (§16.10).
 */

const UNAVAILABLE = "AI suggestion unavailable right now.";
const NOT_ENABLED = "AI features are not enabled.";

/** Run the provider + usage-log tail shared by every suggestion action. */
async function completeAndLog(
  organizationId: string,
  userId: string,
  feature: string,
  prompt: string,
): Promise<ActionResult<string>> {
  let provider: AIProvider;
  let text: string;
  try {
    provider = resolveAiProvider();
    const result = await provider.complete({ prompt, feature });
    text = result.text;
    // Usage is recorded on EVERY call — including zero-cost null calls — so
    // cost reporting is correct from day one with no pre-enablement gap (§16.2).
    await recordAiUsage(organizationId, userId, {
      feature,
      provider: provider.name,
      tokensUsed: result.tokensUsed,
      costEstimate: result.costEstimate.toFixed(4),
    });
  } catch (error) {
    logger.error("AI suggestion failed", {
      feature,
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: UNAVAILABLE };
  }

  // An empty suggestion (e.g. AI_PROVIDER=null while the org flag is on) is a
  // configuration mismatch, not a user error — same calm message (§16.10).
  if (text.trim() === "") return { success: false, error: UNAVAILABLE };
  return { success: true, data: text.trim() };
}

/** Draft customer-facing quote notes from the originating Lead (§16.6). */
export async function generateQuoteDraft(leadId: string): Promise<ActionResult<string>> {
  try {
    const session = await requireSession();
    await requireActiveUser();
    if (session.role !== "OWNER" && session.role !== "STAFF") {
      return { success: false, error: "You do not have access to quote drafting." };
    }
    const { organizationId } = await requireCompanyScope(session);
    if (!(await isFeatureEnabled("ai"))) return { success: false, error: NOT_ENABLED };

    // Pre-scoped load (§16.9): the prompt builder only ever sees this org's lead.
    const lead = await db.lead.findFirst({
      where: { id: leadId, organizationId },
      select: {
        name: true,
        phone: true,
        email: true,
        source: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
    if (!lead) return { success: false, error: "Lead not found." };

    return await completeAndLog(
      organizationId,
      session.id,
      "quote_draft",
      buildQuotePrompt({
        leadName: lead.name,
        leadPhone: lead.phone,
        leadEmail: lead.email,
        sourceName: lead.source?.name ?? null,
        customerName: lead.customer?.name ?? null,
      }),
    );
  } catch (error) {
    unstable_rethrow(error);
    logger.error("generateQuoteDraft failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: UNAVAILABLE };
  }
}

/** Draft a work summary for a Job's notes (§16.5; FIELD allowed on own job, §16.8). */
export async function summarizeJob(jobId: string): Promise<ActionResult<string>> {
  try {
    const session = await requireSession();
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    if (!(await isFeatureEnabled("ai"))) return { success: false, error: NOT_ENABLED };

    const job = await db.job.findFirst({
      where: { id: jobId, organizationId },
      select: {
        status: true,
        scheduledDate: true,
        completedAt: true,
        notes: true,
        assignedToId: true,
        customer: { select: { name: true } },
        quote: { select: { quoteNumber: true } },
      },
    });
    if (!job) return { success: false, error: "Job not found." };
    // §16.8: FIELD rides its existing entity permission — own assigned job only.
    if (session.role === "FIELD" && job.assignedToId !== session.id) {
      return { success: false, error: "Job not found." };
    }

    return await completeAndLog(
      organizationId,
      session.id,
      "job_summary",
      buildJobSummaryPrompt({
        customerName: job.customer.name,
        quoteNumber: job.quote.quoteNumber,
        status: job.status,
        scheduledDate: job.scheduledDate ? job.scheduledDate.toISOString().slice(0, 10) : null,
        completedAt: job.completedAt ? job.completedAt.toISOString().slice(0, 10) : null,
        existingNotes: job.notes,
      }),
    );
  } catch (error) {
    unstable_rethrow(error);
    logger.error("summarizeJob failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { success: false, error: UNAVAILABLE };
  }
}
