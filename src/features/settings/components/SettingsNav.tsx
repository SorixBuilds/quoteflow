"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";

/**
 * Settings sub-navigation (Phase 4, §8). Config sections are OWNER-only; the
 * Account tab is available to every role. Active tab via exact path match.
 */
type SettingsTab = { label: string; href: string; roles: Role[] };

const TABS: SettingsTab[] = [
  { label: "Company Profile", href: "/settings", roles: ["OWNER"] },
  { label: "Business Hours & Locale", href: "/settings/locale", roles: ["OWNER"] },
  { label: "Numbering & Tax", href: "/settings/numbering", roles: ["OWNER"] },
  { label: "PDF & Email", href: "/settings/branding", roles: ["OWNER"] },
  { label: "Email Delivery", href: "/settings/email", roles: ["OWNER"] },
  { label: "Automations", href: "/settings/automations", roles: ["OWNER"] },
  { label: "API Keys", href: "/settings/api-keys", roles: ["OWNER"] },
  { label: "Integrations", href: "/settings/integrations", roles: ["OWNER"] },
  { label: "Feature Flags", href: "/settings/features", roles: ["OWNER"] },
  { label: "Team & Roles", href: "/settings/team", roles: ["OWNER"] },
  {
    label: "Account",
    href: "/settings/account",
    roles: ["OWNER", "STAFF", "FIELD"],
  },
];

export function SettingsNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => tab.roles.includes(role));

  return (
    <nav
      aria-label="Settings sections"
      className="flex flex-wrap gap-1 border-b pb-px"
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
