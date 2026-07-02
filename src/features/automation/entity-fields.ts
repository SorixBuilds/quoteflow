import "server-only";

import { db } from "@/lib/db";
import type { AutomationEntityType } from "@/features/automation/types";
import type { EntitySnapshot } from "@/features/automation/conditions";

/**
 * Entity snapshot loaders (Phase 6B Step 6, §15.7).
 *
 * A rule's conditions evaluate against a **server-authoritative** snapshot of
 * the triggering entity — loaded fresh here, org-scoped, from the live row. The
 * engine never trusts field values carried on the event payload (which only
 * carries an id); a condition on `total` or `status` always reads the current,
 * tenant-owned value. Each loader returns only the whitelisted fields declared
 * in `CONDITION_FIELDS` (a closed evaluable surface), with Decimals coerced to
 * numbers and dates to ISO strings so comparisons are pure and deterministic.
 *
 * Returns `null` when the entity no longer exists (deleted between the event and
 * the handler) or does not belong to the org — the firing is then a safe no-op.
 */

function iso(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export async function loadEntitySnapshot(
  entityType: AutomationEntityType,
  entityId: string,
  organizationId: string,
): Promise<EntitySnapshot | null> {
  switch (entityType) {
    case "LEAD": {
      const lead = await db.lead.findFirst({
        where: { id: entityId, organizationId },
        select: { status: true, name: true, email: true, sourceId: true, assignedToId: true },
      });
      if (!lead) return null;
      return {
        status: lead.status,
        name: lead.name,
        email: lead.email,
        sourceId: lead.sourceId,
        assignedToId: lead.assignedToId,
      };
    }
    case "QUOTE": {
      const quote = await db.quote.findFirst({
        where: { id: entityId, organizationId },
        select: { status: true, total: true, version: true, currency: true },
      });
      if (!quote) return null;
      return {
        status: quote.status,
        total: Number(quote.total),
        version: quote.version,
        currency: quote.currency,
      };
    }
    case "JOB": {
      const job = await db.job.findFirst({
        where: { id: entityId, organizationId },
        select: { status: true, assignedToId: true, scheduledDate: true },
      });
      if (!job) return null;
      return {
        status: job.status,
        assignedToId: job.assignedToId,
        scheduledDate: iso(job.scheduledDate),
      };
    }
    case "INVOICE": {
      const invoice = await db.invoice.findFirst({
        where: { id: entityId, organizationId },
        select: { status: true, amount: true, paidAmount: true, dueDate: true },
      });
      if (!invoice) return null;
      const amount = Number(invoice.amount);
      const paidAmount = Number(invoice.paidAmount);
      return {
        status: invoice.status,
        amount,
        paidAmount,
        balance: Math.max(amount - paidAmount, 0),
        dueDate: iso(invoice.dueDate),
      };
    }
    case "CUSTOMER": {
      const customer = await db.customer.findFirst({
        where: { id: entityId, organizationId },
        select: { type: true, name: true, email: true, phone: true },
      });
      if (!customer) return null;
      return {
        type: customer.type,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      };
    }
    default:
      return null;
  }
}

/**
 * Resolve a system actor for actions that need a `createdById` (create_task,
 * log_activity). Automation runs with no user session, so it acts as the org's
 * owner — the same authority that configured the rule. Returns null only for a
 * malformed org with no active owner, in which case those actions no-op.
 */
export async function resolveSystemActorId(organizationId: string): Promise<string | null> {
  const owner = await db.user.findFirst({
    where: { organizationId, role: "OWNER", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return owner?.id ?? null;
}
