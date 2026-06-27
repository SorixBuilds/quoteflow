import type { ReactNode } from "react";

import { Breadcrumbs, type Crumb } from "@/components/shared/Breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * Shared page layout primitives (Phase 4, §10).
 *
 * The mandatory composition root for every `(dashboard)` route, so no screen
 * re-derives its own padding, title row, or action placement:
 *
 *   <PageLayout>
 *     <PageHeader title="Settings" breadcrumb={["Settings"]}>
 *       <PageActions><Button>Save</Button></PageActions>
 *     </PageHeader>
 *     <PageContent>
 *       <PageSection title="Company Profile">…</PageSection>
 *     </PageContent>
 *   </PageLayout>
 */

/** Outermost root: owns max-width and outer padding for a dashboard route. */
export function PageLayout({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-5xl px-6 py-8", className)}>
      {children}
    </div>
  );
}

/** Title + optional breadcrumb + a right-aligned slot (typically PageActions). */
export function PageHeader({
  title,
  description,
  breadcrumb,
  children,
}: {
  title: string;
  description?: string;
  breadcrumb?: Crumb[];
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      {breadcrumb && breadcrumb.length > 0 ? (
        <Breadcrumbs items={breadcrumb} />
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Right-aligned primary action(s) for the page header. */
export function PageActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2">{children}</div>
  );
}

/** Scrollable body region beneath the header; stacks sections with consistent gaps. */
export function PageContent({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>{children}</div>
  );
}

/** A titled card grouping that breaks a long page into logical blocks. */
export function PageSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-card text-card-foreground rounded-lg border p-6">
      {title || description ? (
        <div className="mb-4">
          {title ? (
            <h2 className="text-base font-semibold">{title}</h2>
          ) : null}
          {description ? (
            <p className="text-muted-foreground mt-1 text-sm">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
