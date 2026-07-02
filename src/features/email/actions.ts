"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { requireActiveUser, requireCompanyScope, requireRole } from "@/lib/permissions";
import { BusinessRuleError, toActionError } from "@/lib/errors";
import { logActivity } from "@/features/activity/actions";
import { getEmailContext } from "@/features/email/branding";
import { rebuildEmailJob } from "@/features/email/dispatch";
import { renderTemplate, type EmailTemplateInput } from "@/features/email/templates";
import { getRetryableLog, sendTemplatedEmail } from "@/features/email/send";
import type { ActionResult } from "@/types";

/**
 * Email feature actions (Phase 6B Step 5, §11.8, §11.10, §13).
 *
 * The ONLY client-callable surface of the Email System — and it deliberately
 * exposes **no** "send arbitrary email" entry point (§11.8 closes the spam-relay
 * class). The two actions here are administrative: re-attempt a previously
 * FAILED send (the Retry button on the Email History tab, §11.10) and render a
 * read-only preview for the settings page (§13). Both are OWNER/STAFF-gated and
 * strictly organization-scoped; `sendTemplatedEmail` itself stays a server-only
 * function, never an action.
 */

/**
 * Retry a FAILED email (§11.10). Re-renders fresh from the related entity (never
 * from stored HTML) and re-enters the flow on the same `EmailLog` row, so the
 * capped attempt counter (`attempts < 5`) advances in place.
 */
export async function retryEmail(emailLogId: string): Promise<ActionResult<{ status: string }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);

    const log = await getRetryableLog(organizationId, emailLogId);
    if (!log) {
      throw new BusinessRuleError("This email is not eligible for retry.");
    }

    const job = await rebuildEmailJob(organizationId, log);
    if (!job) {
      throw new BusinessRuleError("This email cannot be retried automatically.");
    }

    const result = await sendTemplatedEmail({
      organizationId,
      to: job.to,
      template: job.template,
      relatedEntityType: job.relatedEntityType,
      relatedEntityId: job.relatedEntityId,
      attachments: job.attachments,
      existingLogId: log.id,
    });

    await logActivity({
      organizationId,
      entityType: log.relatedEntityType ?? "ORGANIZATION",
      entityId: log.relatedEntityId ?? organizationId,
      type: "email_retried",
      message: log.templateType,
      createdById: session.id,
    });

    if (log.relatedEntityType && log.relatedEntityId) {
      revalidatePath(`/${entityPath(log.relatedEntityType)}/${log.relatedEntityId}`);
    }
    return { success: true, data: { status: result?.status ?? "FAILED" } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** A read-only HTML preview of a template with sample data (§13 admin preview). */
export async function previewEmailTemplate(
  input: EmailTemplateInput,
): Promise<ActionResult<{ subject: string; html: string }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    const { organizationId } = await requireCompanyScope(session);
    const { brand } = await getEmailContext(organizationId);
    const { subject, html } = renderTemplate(input, brand);
    return { success: true, data: { subject, html } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Map an EntityType to its dashboard detail route segment for revalidation. */
function entityPath(entityType: string): string {
  switch (entityType) {
    case "QUOTE":
      return "quotes";
    case "INVOICE":
      return "invoices";
    case "JOB":
      return "jobs";
    case "CUSTOMER":
      return "customers";
    case "LEAD":
      return "leads";
    default:
      return "settings";
  }
}
