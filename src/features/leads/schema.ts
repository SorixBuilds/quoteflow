import { z } from "zod";

/**
 * Lead validation (Phase 5, §14, §28). Create/update share the base shape; the
 * status-change action uses `leadStatusChangeSchema`, which conditionally
 * requires `lostReason` only when the target is LOST (§28 superRefine) — the
 * column stays nullable for every other status, so this is an action concern,
 * not a DB constraint.
 */

export const leadSchema = z.object({
  name: z.string().trim().min(1, "A lead name is required.").max(200),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  phone: z.string().trim().min(1, "A phone number is required.").max(40),
  sourceId: z.string().uuid().optional().or(z.literal("")),
  assignedToId: z.string().uuid().optional().or(z.literal("")),
});

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUOTED",
  "WON",
  "LOST",
] as const;

export const leadStatusChangeSchema = z
  .object({
    status: z.enum(LEAD_STATUSES),
    lostReason: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "LOST" && (!data.lostReason || data.lostReason.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["lostReason"],
        message: "A reason is required when marking a lead as lost.",
      });
    }
  });

export type LeadInput = z.input<typeof leadSchema>;
export type LeadStatusChangeInput = z.infer<typeof leadStatusChangeSchema>;
