import type { ReactNode } from "react";
import Link from "next/link";
import { Workflow } from "lucide-react";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { requireSession } from "@/features/auth/queries";
import { siteConfig } from "@/config/site";

/**
 * Authenticated app shell. Calls `requireSession()` so every nested route is
 * guarded server-side as well as by middleware (defense in depth, §6.5). Renders
 * the topbar with the current user and the logout control.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
              <Workflow className="size-4" />
            </div>
            <span className="text-foreground text-sm font-semibold">
              {siteConfig.name}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {user.name || user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
