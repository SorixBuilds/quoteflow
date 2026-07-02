import type { EntityType, Role } from "@prisma/client";

import { db } from "@/lib/db";

/**
 * Attachment authorization & tenant-scope gate (§14.8, §14.9).
 *
 * The *single* place that answers "may this caller manage files on this parent
 * record?" — so the `attachFile`/`removeAttachment`/`renameAttachment` actions
 * stay entity-agnostic (they call one function and never special-case a type).
 * Centralizing the per-entity mapping here is the same discipline `logActivity`
 * uses for the polymorphic `entityId`: the polymorphism is real, so it lives in
 * exactly one audited module instead of being scattered across call sites.
 *
 * Two things are enforced together:
 *   1. **Role gate (§14.8)** — an attachment follows the parent's edit
 *      permission. FIELD may manage files only on a Job assigned to them;
 *      OWNER/STAFF on any business entity; organization-level "Company documents"
 *      (`entityType = null`) are OWNER-only.
 *   2. **Tenant scope / IDOR (§14.9)** — the parent row must actually exist
 *      inside the caller's organization (and, for a FIELD user's Job, be assigned
 *      to them). A row id belonging to another tenant resolves to "not
 *      manageable," never leaking whether it exists.
 */

export type FileScope = {
  organizationId: string;
  role: Role;
  userId: string;
};

/** Roles permitted to edit a normal business entity (everything but FIELD). */
const MANAGER_ROLES: readonly Role[] = ["OWNER", "STAFF"];

/**
 * Whether `entityId` names a row of `entityType` that `scope` is allowed to edit.
 * The query is always organization-scoped; a FIELD user's Job additionally
 * requires self-assignment. The lookup `select`s only `id` — existence, nothing
 * more.
 */
async function entityExistsInScope(
  scope: FileScope,
  entityType: EntityType,
  entityId: string,
): Promise<boolean> {
  const { organizationId, role, userId } = scope;

  switch (entityType) {
    case "JOB": {
      // The one per-row access tier in the system (§29): FIELD sees only its own.
      const where =
        role === "FIELD"
          ? { id: entityId, organizationId, assignedToId: userId }
          : { id: entityId, organizationId };
      const row = await db.job.findFirst({ where, select: { id: true } });
      return row !== null;
    }
    case "LEAD": {
      const row = await db.lead.findFirst({
        where: { id: entityId, organizationId },
        select: { id: true },
      });
      return row !== null;
    }
    case "QUOTE": {
      const row = await db.quote.findFirst({
        where: { id: entityId, organizationId },
        select: { id: true },
      });
      return row !== null;
    }
    case "CUSTOMER": {
      const row = await db.customer.findFirst({
        where: { id: entityId, organizationId },
        select: { id: true },
      });
      return row !== null;
    }
    case "INVOICE": {
      const row = await db.invoice.findFirst({
        where: { id: entityId, organizationId },
        select: { id: true },
      });
      return row !== null;
    }
    case "ORGANIZATION": {
      // An ORGANIZATION-typed reference can only be the caller's own tenant.
      return entityId === organizationId;
    }
    default: {
      // Exhaustiveness guard: a new EntityType must be considered here explicitly.
      const _never: never = entityType;
      return _never;
    }
  }
}

/**
 * The authorization decision for a file-management operation against a target.
 * `entityType = null` (with `entityId = null`) is an organization-level file.
 * Returns `true` only when the caller passes both the role gate and the tenant
 * scope check; otherwise `false` (callers map that to a single, non-leaking
 * "no access" error).
 */
export async function canManageAttachmentTarget(
  scope: FileScope,
  entityType: EntityType | null,
  entityId: string | null,
): Promise<boolean> {
  // Organization-level "Company documents": OWNER-only, no parent row to scope.
  if (entityType === null || entityId === null) {
    return scope.role === "OWNER";
  }

  // FIELD may only ever touch Jobs (assigned to them); never Leads/Quotes/etc.
  if (scope.role === "FIELD" && entityType !== "JOB") {
    return false;
  }

  // Non-Job business entities are OWNER/STAFF only.
  if (entityType !== "JOB" && !MANAGER_ROLES.includes(scope.role)) {
    return false;
  }

  return entityExistsInScope(scope, entityType, entityId);
}
