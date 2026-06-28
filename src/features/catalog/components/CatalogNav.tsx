"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/** Catalog sub-navigation (Phase 5, §10). OWNER/STAFF; write gating is per-page. */
const TABS = [
  { label: "Services", href: "/catalog/services" },
  { label: "Categories", href: "/catalog/categories" },
  { label: "Tax Rates", href: "/catalog/tax-rates" },
  { label: "Lead Sources", href: "/catalog/lead-sources" },
];

export function CatalogNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Catalog sections" className="flex flex-wrap gap-1 border-b pb-px">
      {TABS.map((tab) => {
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
