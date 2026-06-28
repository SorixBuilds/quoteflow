import { z } from "zod";

/**
 * Job validation (Phase 5, §20, §23). Jobs are never created by a form (only by
 * `acceptQuote`, §20) — so there is no "create job" schema. Scheduling sets the
 * date and the FIELD assignee; status changes use the conditional-transition
 * action. CANCELLED requires a confirmation note (stored as Activity, §22).
 */

export const scheduleJobSchema = z.object({
  scheduledDate: z.string().optional().or(z.literal("")),
  assignedToId: z.string().uuid().optional().or(z.literal("")),
});

export const JOB_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export type ScheduleJobInput = z.input<typeof scheduleJobSchema>;
