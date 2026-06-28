"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { JobStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { requireActiveUser, requireRole } from "@/lib/permissions";
import { canTransitionJob, JOB_STATUS_LABELS } from "@/lib/status";
import { logActivity } from "@/features/activity/actions";
import { createNotification } from "@/features/notifications/actions";
import { scheduleJobSchema, type ScheduleJobInput } from "@/features/jobs/schema";
import { BusinessRuleError, STALE_TRANSITION_MESSAGE, toActionError } from "@/lib/errors";
import type { ActionResult } from "@/types";

/**
 * Job write path (Phase 5, §20, §22, §23, §29). Scheduling/assignment is
 * OWNER/STAFF only; a FIELD user can advance the status of, and add notes to,
 * only their own jobs (the `assignedToId = self` clause is applied in the WHERE,
 * not just the UI). Status changes are conditional updates (§22).
 */

/** Schedule a job and/or assign it to a FIELD technician (§20, §23). */
export async function scheduleJob(
  id: string,
  input: ScheduleJobInput,
): Promise<ActionResult<null>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const organizationId = session.organizationId;
    const data = scheduleJobSchema.parse(input);

    const assignedToId = data.assignedToId ? data.assignedToId : null;
    if (assignedToId) {
      const tech = await db.user.findFirst({
        where: { id: assignedToId, organizationId, role: "FIELD", isActive: true },
        select: { id: true },
      });
      if (!tech) throw new BusinessRuleError("Jobs can only be assigned to a field technician.");
    }

    const job = await db.job.findFirst({
      where: { id, organizationId },
      select: { id: true, assignedToId: true, customer: { select: { name: true } } },
    });
    if (!job) return { success: false, error: "Job not found." };

    const scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null;
    await db.job.update({
      where: { id },
      data: { scheduledDate, assignedToId },
    });

    await logActivity({
      organizationId,
      entityType: "JOB",
      entityId: id,
      type: "job_scheduled",
      message: scheduledDate ? `Scheduled for ${scheduledDate.toLocaleDateString()}` : "Schedule cleared",
      createdById: session.id,
    });

    // Notify the technician on a new assignment (§25).
    if (assignedToId && assignedToId !== job.assignedToId) {
      await logActivity({
        organizationId,
        entityType: "JOB",
        entityId: id,
        type: "job_assigned",
        createdById: session.id,
      });
      await createNotification({
        userId: assignedToId,
        type: "job_assigned",
        title: "Job assigned to you",
        body: job.customer.name,
        priority: "NORMAL",
        entityType: "JOB",
        entityId: id,
        actionUrl: `/jobs/${id}`,
        actionLabel: "View job",
      });
    }

    revalidatePath(`/jobs/${id}`);
    revalidatePath("/jobs");
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function changeJobStatus(
  id: string,
  target: string,
  note?: string,
): Promise<ActionResult<{ status: JobStatus }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF", "FIELD"]);
    await requireActiveUser();
    const organizationId = session.organizationId;

    if (!["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(target)) {
      return { success: false, error: "Unsupported status." };
    }
    const status = target as JobStatus;
    if (status === "CANCELLED" && (!note || note.trim().length === 0)) {
      throw new BusinessRuleError("A reason is required to cancel a job.");
    }

    // FIELD users can only touch their own jobs (§29).
    const scope: Prisma.JobWhereInput =
      session.role === "FIELD"
        ? { id, organizationId, assignedToId: session.id }
        : { id, organizationId };

    const job = await db.job.findFirst({ where: scope, select: { status: true } });
    if (!job) return { success: false, error: "Job not found." };

    // FIELD cannot cancel — only OWNER/STAFF (cancellation is a management action).
    if (status === "CANCELLED" && session.role === "FIELD") {
      throw new BusinessRuleError("Only an owner or staff member can cancel a job.");
    }
    if (!canTransitionJob(job.status, status)) {
      throw new BusinessRuleError(
        `A job cannot move from ${JOB_STATUS_LABELS[job.status]} to ${JOB_STATUS_LABELS[status]}.`,
      );
    }

    const result = await db.job.updateMany({
      where: { ...scope, status: job.status },
      data: {
        status,
        completedAt: status === "COMPLETED" ? new Date() : undefined,
      },
    });
    if (result.count === 0) return { success: false, error: STALE_TRANSITION_MESSAGE };

    const activityType =
      status === "COMPLETED" ? "job_completed" : status === "CANCELLED" ? "job_cancelled" : "status_changed";
    await logActivity({
      organizationId,
      entityType: "JOB",
      entityId: id,
      type: activityType,
      message:
        status === "CANCELLED"
          ? `Cancelled: ${note}`
          : `${JOB_STATUS_LABELS[job.status]} → ${JOB_STATUS_LABELS[status]}`,
      createdById: session.id,
    });

    revalidatePath(`/jobs/${id}`);
    revalidatePath("/jobs");
    return { success: true, data: { status } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Update a job's notes (FIELD own-jobs, OWNER/STAFF any, §20). */
export async function updateJobNotes(id: string, notes: string): Promise<ActionResult<null>> {
  try {
    const session = await requireRole(["OWNER", "STAFF", "FIELD"]);
    await requireActiveUser();
    const organizationId = session.organizationId;

    const scope: Prisma.JobWhereInput =
      session.role === "FIELD"
        ? { id, organizationId, assignedToId: session.id }
        : { id, organizationId };

    const result = await db.job.updateMany({ where: scope, data: { notes: notes.trim() || null } });
    if (result.count === 0) return { success: false, error: "Job not found." };

    revalidatePath(`/jobs/${id}`);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}
