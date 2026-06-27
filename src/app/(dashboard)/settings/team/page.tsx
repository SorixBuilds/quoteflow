import type { Metadata } from "next";

import { TeamManager, type TeamMember } from "@/components/auth/TeamManager";
import { db } from "@/lib/db";
import { requireRole } from "@/features/auth/queries";
import { OWNER_ONLY_ROLES } from "@/features/auth/types";

export const metadata: Metadata = { title: "Team" };

/**
 * Team management — Owner-only (§9.5, §10.1). `requireRole` enforces the
 * boundary server-side; a non-owner reaching this route is redirected with the
 * insufficient-role toast before any data is read. The member list is scoped to
 * the caller's organization (§10.4).
 */
export default async function TeamSettingsPage() {
  const owner = await requireRole(OWNER_ONLY_ROLES);

  const users = await db.user.findMany({
    where: { organizationId: owner.organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  const members: TeamMember[] = users.map((user) => ({
    ...user,
    isSelf: user.id === owner.id,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          Team
        </h1>
        <p className="text-muted-foreground text-sm">
          Add team members and manage their roles. New members receive a
          one-time temporary password.
        </p>
      </div>
      <TeamManager members={members} />
    </div>
  );
}
