import type { ReactNode } from "react";
import Link from "next/link";
import { Workflow } from "lucide-react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { siteConfig } from "@/config/site";

/**
 * Persistent top bar (Phase 4, §8). Brand on the left; a global-search slot and
 * a notifications slot in the middle/right (wired by Step 15 and Step 11
 * respectively); the current user and sign-out on the far right. The slots are
 * optional `ReactNode` props so later steps inject their UI without rewriting
 * the shell.
 */
export function Topbar({
  userLabel,
  search,
  notifications,
}: {
  userLabel: string;
  search?: ReactNode;
  notifications?: ReactNode;
}) {
  return (
    <header className="border-b">
      <div className="flex h-14 w-full items-center gap-4 px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <Workflow className="size-4" />
          </div>
          <span className="text-foreground text-sm font-semibold">
            {siteConfig.name}
          </span>
        </Link>

        {search ? <div className="flex-1">{search}</div> : <div className="flex-1" />}

        <div className="flex items-center gap-3">
          {notifications}
          <span className="text-muted-foreground hidden text-sm sm:inline">
            {userLabel}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
