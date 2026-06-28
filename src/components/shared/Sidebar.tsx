"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@prisma/client";
import type { FeatureFlags } from "@/lib/config/schema";
import { filterNav } from "@/config/nav";
import { cn } from "@/lib/utils";

/**
 * Role- and flag-filtered primary navigation (Phase 4, §8). Client component:
 * highlights the active route via `usePathname()`. It receives only serializable
 * props (the role and the plain feature-flags object) and imports the nav model
 * itself, so the Lucide icon components never cross the server/client boundary.
 */
export function Sidebar({
  role,
  featureFlags,
}: {
  role: Role;
  featureFlags: FeatureFlags;
}) {
  const pathname = usePathname();
  const items = filterNav(role, featureFlags);

  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
