import { z } from "zod";

/**
 * Email persistence validation (§7.2.1, §11). `templateType` and `status` are
 * free-text strings (the frozen Activity.type / Notification.type precedent for
 * open-ended, additive taxonomies), so they are validated as bounded non-empty
 * strings rather than enums. The known status set is provided as a const for
 * call sites, not as a DB constraint.
 */

/** Terminal + transitional statuses an EmailLog row moves through (§7.2.1). */
export const EMAIL_STATUSES = [
  "QUEUED",
  "SIMULATED",
  "SENT",
  "DELIVERED",
  "BOUNCED",
  "FAILED",
] as const;

export type EmailStatus = (typeof EMAIL_STATUSES)[number];

const entityTypeEnum = z.enum([
  "LEAD",
  "QUOTE",
  "JOB",
  "CUSTOMER",
  "INVOICE",
  "ORGANIZATION",
]);

/** Input accepted by the email repository to record an attempted send. */
export const createEmailLogSchema = z.object({
  toEmail: z.string().trim().email(),
  fromEmail: z.string().trim().email(),
  subject: z.string().trim().min(1).max(500),
  templateType: z.string().trim().min(1).max(100),
  relatedEntityType: entityTypeEnum.optional(),
  relatedEntityId: z.string().uuid().optional(),
  status: z.enum(EMAIL_STATUSES).optional(),
  providerMessageId: z.string().trim().min(1).optional(),
});

export type CreateEmailLogInput = z.infer<typeof createEmailLogSchema>;
