import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  Building2,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Users,
  Zap,
} from "lucide-react";

import type { Role } from "@prisma/client";
import type { FeatureFlagKey, FeatureFlags } from "@/lib/config/schema";

/**
 * Sidebar navigation model (Phase 4, §8, §20).
 *
 * A single source of truth for the dashboard nav. Each item declares the roles
 * permitted to see it and, optionally, the feature flag that gates it. The
 * Sidebar filters this list with {@link filterNav} using the live session role
 * and the tenant's `featureFlags` (read through the Configuration Service) — the
 * list is never hardcoded per role at the call site.
 */
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  /** When set, the item renders only if this flag is `true` for the tenant. */
  featureFlag?: FeatureFlagKey;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["OWNER", "STAFF"],
  },
  { label: "Leads", href: "/leads", icon: Users, roles: ["OWNER", "STAFF"] },
  {
    label: "Quotes",
    href: "/quotes",
    icon: FileText,
    roles: ["OWNER", "STAFF"],
  },
  {
    label: "Jobs",
    href: "/jobs",
    icon: Briefcase,
    roles: ["OWNER", "STAFF", "FIELD"],
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: Receipt,
    roles: ["OWNER", "STAFF"],
  },
  {
    label: "Customers",
    href: "/customers",
    icon: Building2,
    roles: ["OWNER", "STAFF"],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: BarChart3,
    roles: ["OWNER", "STAFF"],
  },
  {
    label: "Catalog",
    href: "/catalog",
    icon: Package,
    roles: ["OWNER", "STAFF"],
  },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["OWNER"] },
  // Feature-flagged, not-yet-built module. Hidden by default (flag defaults to
  // false); proves the flag mechanism end-to-end (Step 17, §20).
  {
    label: "Automations",
    href: "/automations",
    icon: Zap,
    roles: ["OWNER", "STAFF"],
    featureFlag: "automation",
  },
] as const;

/**
 * Filter the nav for a session: an item is shown when the role is permitted AND
 * (it is unflagged OR its flag is enabled for the tenant). Pure — unit-tested.
 */
export function filterNav(
  role: Role,
  featureFlags: FeatureFlags,
  items: readonly NavItem[] = NAV_ITEMS,
): NavItem[] {
  return items.filter(
    (item) =>
      item.roles.includes(role) &&
      (item.featureFlag === undefined || featureFlags[item.featureFlag]),
  );
}
