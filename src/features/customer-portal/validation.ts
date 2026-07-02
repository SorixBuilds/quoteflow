import { z } from "zod";

import { customerSchema } from "@/features/customers/schema";

/**
 * Customer-portal token issuance validation (§7.2.7, §12). A staff member issues
 * a token for a specific customer, optionally labelled (e.g. "Sent via text") and
 * optionally time-limited. Expiry, if given, must be in the future.
 */
export const issuePortalTokenSchema = z.object({
  customerId: z.string().uuid(),
  label: z.string().trim().min(1).max(120).optional(),
  expiresAt: z
    .date()
    .refine((d) => d.getTime() > Date.now(), { message: "Expiry must be in the future." })
    .optional(),
});

export type IssuePortalTokenInput = z.infer<typeof issuePortalTokenSchema>;

/**
 * Staff-facing issuance form input (§12.6). The form sends a relative expiry in
 * days; the action turns it into the absolute `expiresAt` the repository stores.
 */
export const issuePortalTokenFormSchema = z.object({
  customerId: z.string().uuid(),
  label: z.string().trim().min(1).max(120).optional().or(z.literal("")),
  expiresInDays: z.coerce.number().int().min(1).max(365).default(90),
});

export type IssuePortalTokenFormInput = z.input<typeof issuePortalTokenFormSchema>;

/**
 * Portal contact-info update (§12.3, §12.10). The portal may write ONLY
 * `email`/`phone`/`address` — never `name`/`type` — so we reuse the internal
 * Customer schema's exact field validators (imported, not duplicated) and pick
 * just those three. This guarantees the portal and the staff app validate a
 * customer's contact details identically.
 */
export const portalContactSchema = customerSchema.pick({
  email: true,
  phone: true,
  address: true,
});

export type PortalContactInput = z.input<typeof portalContactSchema>;
