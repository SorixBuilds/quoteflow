import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared error state (Phase 4, §9). Rendered when a list/feed/section fails to
 * load. Presentational — a retry control is passed in as `action`.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this. Please try again.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border px-6 py-12 text-center",
        className,
      )}
    >
      <div className="bg-destructive/10 text-destructive flex size-10 items-center justify-center rounded-full">
        <AlertTriangle className="size-5" />
      </div>
      <div>
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
