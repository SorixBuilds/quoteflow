import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { requireCompanyScope } from "@/lib/permissions";

/**
 * Org user lookups for the assignment surfaces (Phase 5, §23). Lead assignment
 * filters to STAFF; Job assignment filters to FIELD. One company-scoped query
 * parameterized by role, consumed by the shared `<AssigneeSelect>`. Only active
 * users are assignable.
 */
export async function getAssignableUsers(
  roles: Role[],
): Promise<{ id: string; name: string }[]> {
  const { organizationId } = await requireCompanyScope();
  return db.user.findMany({
    where: { organizationId, isActive: true, role: { in: roles } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
