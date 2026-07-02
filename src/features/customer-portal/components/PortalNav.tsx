"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Hammer, LogOut, Receipt, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { logoutPortal } from "@/features/customer-portal/actions";

/**
 * Portal navigation (§12.5) — exactly four destinations (Quotes, Invoices, Jobs,
 * Account) plus the org wordmark linking home and a logout control. This is the
 * customer's entire surface: there is no sidebar, no settings, no link that could
 * reach an internal route. Built only from the shared design tokens (§10).
 */

const LINKS = [
  { href: "/portal/quotes", label: "Quotes", icon: FileText },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt },
  { href: "/portal/jobs", label: "Jobs", icon: Hammer },
  { href: "/portal/account", label: "Account", icon: User },
] as const;

export function PortalNav({ organizationName }: { organizationName: string }) {
  const pathname = usePathname();

  return (
    <header className="border-border bg-card border-b">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/portal" className="text-foreground text-base font-semibold">
          {organizationName}
        </Link>

        <nav className="flex items-center gap-1" aria-label="Portal">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                <Icon />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}

          <form action={logoutPortal}>
            <button
              type="submit"
              title="Sign out"
              className="text-muted-foreground hover:text-foreground hover:bg-accent/50 ml-1 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors [&_svg]:size-4"
            >
              <LogOut />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
