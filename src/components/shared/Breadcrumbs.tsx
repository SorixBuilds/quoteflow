import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Presentational breadcrumb trail (Phase 4, §8). Consumed by `<PageHeader>`
 * (Step 7). The last crumb is the current page (not a link); earlier crumbs link
 * when they carry an `href`. Plain strings are accepted as a convenience.
 */
export type Crumb = string | { label: string; href?: string };

function normalize(crumb: Crumb): { label: string; href?: string } {
  return typeof crumb === "string" ? { label: crumb } : crumb;
}

export function Breadcrumbs({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("text-muted-foreground text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((raw, index) => {
          const crumb = normalize(raw);
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              <li>
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} className="hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={isLast ? "text-foreground font-medium" : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
