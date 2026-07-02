import "server-only";

import type { z } from "zod";

import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events";
import { BusinessRuleError } from "@/lib/errors";
import { logActivity } from "@/features/activity/actions";
import { leadSchema } from "@/features/leads/schema";
import type { ActorScope } from "@/types";

/**
 * Lead business core (Phase 6B Step 8, §21.6) — the single implementation
 * behind both the staff server action (`actions.ts`) and the Public API's
 * `POST /api/v1/leads`. Extracted from the Phase 5 action body with one
 * tightening: `sourceId`/`assignedToId` references are now verified to belong
 * to the caller's organization (§22.3 — the API is a hostile-input surface,
 * so foreign-id references fail as a business-rule error instead of being
 * stored). The internal UI only ever offered in-org values, so its behavior
 * is unchanged.
 */

export type LeadData = z.output<typeof leadSchema>;

/** Create a NEW lead: row + Activity + assignee notification + `lead.created`. */
export async function createLeadCore(
  scope: ActorScope,
  data: LeadData,
): Promise<{ id: string }> {
  const { organizationId, actorId } = scope;
  const sourceId = data.sourceId ? data.sourceId : null;
  const assignedToId = data.assignedToId ? data.assignedToId : null;

  if (sourceId) {
    const source = await db.leadSource.findFirst({
      where: { id: sourceId, organizationId },
      select: { id: true },
    });
    if (!source) throw new BusinessRuleError("That lead source could not be found.");
  }
  if (assignedToId) {
    // Leads are assigned to OWNER/STAFF within the org (same rule as reassignLead).
    const assignee = await db.user.findFirst({
      where: { id: assignedToId, organizationId, role: { in: ["OWNER", "STAFF"] }, isActive: true },
      select: { id: true },
    });
    if (!assignee) throw new BusinessRuleError("That user cannot be assigned leads.");
  }

  const lead = await db.lead.create({
    data: {
      organizationId,
      name: data.name,
      email: data.email ? data.email : null,
      phone: data.phone,
      sourceId,
      assignedToId,
      status: "NEW",
    },
    select: { id: true, assignedToId: true },
  });

  await logActivity({
    organizationId,
    entityType: "LEAD",
    entityId: lead.id,
    type: "created",
    createdById: actorId,
  });

  if (lead.assignedToId) {
    // Session-free assignee notification — same row shape the staff action's
    // `createNotification` produced, scoped by the core's own organizationId.
    await db.notification.create({
      data: {
        organizationId,
        userId: lead.assignedToId,
        type: "lead_assigned",
        title: "Lead assigned to you",
        body: data.name,
        priority: "NORMAL",
        entityType: "LEAD",
        entityId: lead.id,
        actionUrl: `/leads/${lead.id}`,
        actionLabel: "View lead",
      },
    });
  }

  emitEvent("lead.created", { organizationId, leadId: lead.id });

  return { id: lead.id };
}
