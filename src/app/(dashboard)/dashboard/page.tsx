import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, Users } from "lucide-react";

import { DashboardNotices } from "@/components/auth/DashboardNotices";
import { requireSession } from "@/features/auth/queries";

export const metadata: Metadata = { title: "Dashboard" };

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  STAFF: "Staff",
  FIELD: "Field",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Minimal authenticated landing — the redirect target for login and bootstrap.
 * Business dashboards arrive in later phases; for Phase 3 this confirms the
 * session round-trips and hosts the insufficient-role toast (§11.3).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSession();
  const { error } = await searchParams;

  return (
    <div className="space-y-8">
      <DashboardNotices error={firstParam(error)} />

      <div className="space-y-1">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Welcome, {user.name || user.email}
        </h1>
        <p className="text-muted-foreground text-sm">
          You are signed in as {ROLE_LABELS[user.role] ?? user.role}. Business
          modules arrive in upcoming phases.
        </p>
      </div>

      <nav className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/settings/account"
          className="hover:bg-accent flex items-center gap-3 rounded-lg border p-4 text-sm transition-colors"
        >
          <KeyRound className="text-muted-foreground size-5" />
          <span className="text-foreground font-medium">
            Account &amp; password
          </span>
        </Link>
        {user.role === "OWNER" && (
          <Link
            href="/settings/team"
            className="hover:bg-accent flex items-center gap-3 rounded-lg border p-4 text-sm transition-colors"
          >
            <Users className="text-muted-foreground size-5" />
            <span className="text-foreground font-medium">Team management</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
