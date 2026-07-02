import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/features/documents/types";

/** One downloadable document for an entity. */
export type DocumentLink = { type: DocumentType; label: string };

/**
 * Header download control (§10.6 completion criterion) — renders one styled link
 * per available document type, each pointing at the internal render route. A
 * plain anchor (server component, no client JS): the browser streams the PDF and
 * the route re-checks the session + organization scope on every request.
 */
export function DocumentDownloadLinks({
  entityId,
  links,
}: {
  entityId: string;
  links: DocumentLink[];
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {links.map((link) => (
        <a
          key={link.type}
          href={`/api/documents/${link.type}/${entityId}`}
          target="_blank"
          rel="noopener"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
