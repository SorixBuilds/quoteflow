import { cn } from "@/lib/utils";

/**
 * Shared loading placeholders (Phase 4, §9). `Skeleton` is the primitive block;
 * `LoadingSkeleton` renders a small stack of lines for the common
 * "section is loading" case. Used in place of a bespoke spinner per screen.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      data-testid="skeleton"
      aria-hidden="true"
      className={cn("bg-muted animate-pulse rounded-md", className)}
    />
  );
}

export function LoadingSkeleton({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("flex flex-col gap-3", className)}
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === 0 ? "w-1/3" : "w-full")} />
      ))}
    </div>
  );
}
