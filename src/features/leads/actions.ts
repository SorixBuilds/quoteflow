"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { LeadStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { requireActiveUser, requireCompanyScope, requireRole } from "@/lib/permissions";
import { canTransitionLead, LEAD_STATUS_LABELS } from "@/lib/status";
import { logActivity } from "@/features/activity/actions";
import { createNotification } from "@/features/notifications/actions";
import { BusinessRuleError, STALE_TRANSITION_MESSAGE, toActionError } from "@/lib/errors";
import { leadSchema, leadStatusChangeSchema, type LeadInput } from "@/features/leads/schema";
import type { ActionResult } from "@/types";

/**
 * Lead write path (Phase 5, §14, §22, §23). Status transitions are conditional
 * updates (`WHERE id = ? AND status = <expected>`, §22) validated against the
 * shared transition map, with the WON-needs-Customer and LOST-needs-reason rules
 * enforced server-side. Reassignment logs Activity and fires a notification.
 */

export async function createLead(input: LeadInput): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = leadSchema.parse(input);

    const lead = await db.lead.create({
      data: {
        organizationId,
        name: data.name,
        email: data.email ? data.email : null,
        phone: data.phone,
        sourceId: data.sourceId ? data.sourceId : null,
        assignedToId: data.assignedToId ? data.assignedToId : null,
        status: "NEW",
      },
      select: { id: true, assignedToId: true },
    });

    await logActivity({
      organizationId,
      entityType: "LEAD",
      entityId: lead.id,
      type: "created",
      createdById: session.id,
    });

    if (lead.assignedToId) {
      await notifyAssignee(lead.assignedToId, lead.id, data.name);
    }

    revalidatePath("/leads");
    return { success: true, data: { id: lead.id } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

export async function updateLead(id: string, input: LeadInput): Promise<ActionResult<null>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);
    const data = leadSchema.parse(input);

    const result = await db.lead.updateMany({
      where: { id, organizationId },
      data: {
        name: data.name,
        email: data.email ? data.email : null,
        phone: data.phone,
        sourceId: data.sourceId ? data.sourceId : null,
      },
    });
    if (result.count === 0) return { success: false, error: "Lead not found." };

    revalidatePath(`/leads/${id}`);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Reassign a Lead to a STAFF user (§23). Logs Activity + notifies the assignee. */
export async function reassignLead(
  id: string,
  assignedToId: string | null,
): Promise<ActionResult<null>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);

    if (assignedToId) {
      // Leads are assigned to STAFF only (not FIELD), and within the org.
      const assignee = await db.user.findFirst({
        where: { id: assignedToId, organizationId, role: { in: ["OWNER", "STAFF"] }, isActive: true },
        select: { id: true },
      });
      if (!assignee) throw new BusinessRuleError("That user cannot be assigned leads.");
    }

    const lead = await db.lead.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true },
    });
    if (!lead) return { success: false, error: "Lead not found." };

    await db.lead.update({ where: { id }, data: { assignedToId } });
    await logActivity({
      organizationId,
      entityType: "LEAD",
      entityId: id,
      type: "assigned",
      createdById: session.id,
    });

    if (assignedToId) await notifyAssignee(assignedToId, id, lead.name);

    revalidatePath(`/leads/${id}`);
    return { success: true, data: null };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

/** Conditional status transition (§22). `note` carries `lostReason` for LOST. */
export async function changeLeadStatus(
  id: string,
  target: string,
  note?: string,
): Promise<ActionResult<{ status: LeadStatus }>> {
  try {
    const session = await requireRole(["OWNER", "STAFF"]);
    await requireActiveUser();
    const { organizationId } = await requireCompanyScope(session);

    const { status, lostReason } = leadStatusChangeSchema.parse({ status: target, lostReason: note });

    const lead = await db.lead.findFirst({
      where: { id, organizationId },
      select: { status: true, customerId: true },
    });
    if (!lead) return { success: false, error: "Lead not found." };

    if (!canTransitionLead(lead.status, status)) {
      throw new BusinessRuleError(
        `A lead cannot move from ${LEAD_STATUS_LABELS[lead.status]} to ${LEAD_STATUS_LABELS[status]}.`,
      );
    }
    // §14 / §35 rule #3: WON requires a linked Customer.
    if (status === "WON" && !lead.customerId) {
      throw new BusinessRuleError(
        "Link a customer to this lead (create a quote for it) before marking it Won.",
      );
    }

    const result = await db.lead.updateMany({
      where: { id, organizationId, status: lead.status },
      data: { status, lostReason: status === "LOST" ? lostReason : null },
    });
    if (result.count === 0) {
      return { success: false, error: STALE_TRANSITION_MESSAGE };
    }

    await logActivity({
      organizationId,
      entityType: "LEAD",
      entityId: id,
      type: "status_changed",
      message: `${LEAD_STATUS_LABELS[lead.status]} → ${LEAD_STATUS_LABELS[status]}${
        status === "LOST" && lostReason ? ` (${lostReason})` : ""
      }`,
      createdById: session.id,
    });

    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    return { success: true, data: { status } };
  } catch (error) {
    unstable_rethrow(error);
    return toActionError(error);
  }
}

async function notifyAssignee(userId: string, leadId: string, leadName: string) {
  // createNotification scopes to the caller's org and reads its own session.
  await createNotification({
    userId,
    type: "lead_assigned",
    title: "Lead assigned to you",
    body: leadName,
    priority: "NORMAL",
    entityType: "LEAD",
    entityId: leadId,
    actionUrl: `/leads/${leadId}`,
    actionLabel: "View lead",
  });
}
