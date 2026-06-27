"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { globalSearch } from "@/features/search/actions";
import type { SearchResult, SearchResults } from "@/features/search/types";

/**
 * Topbar global search (Phase 4, §17). Debounced, never cached (staleness here is
 * actively misleading, §21): every settled keystroke re-queries. Results are
 * grouped by entity and ordered by the three-tier ranking from the server.
 */
const DEBOUNCE_MS = 250;

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    let active = true;
    const handle = setTimeout(async () => {
      if (q.length < 2) {
        if (active) {
          setResults(null);
          setOpen(false);
        }
        return;
      }
      const r = await globalSearch(q);
      if (active) {
        setResults(r);
        setOpen(true);
      }
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  function go(result: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  const groups = results
    ? [
        { label: "Leads", items: results.leads },
        { label: "Customers", items: results.customers },
      ].filter((g) => g.items.length > 0)
    : [];
  const hasResults = groups.length > 0;

  return (
    <div ref={containerRef} className="relative max-w-md">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={query}
          placeholder="Search leads & customers…"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-8"
          aria-label="Global search"
        />
      </div>

      {open && results ? (
        <div className="bg-popover text-popover-foreground absolute left-0 z-50 mt-2 w-full rounded-md border shadow-md">
          {hasResults ? (
            <div className="max-h-96 overflow-y-auto py-1">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="text-muted-foreground px-3 py-1.5 text-xs font-medium">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(item)}
                      className="hover:bg-accent flex w-full flex-col items-start px-3 py-2 text-left"
                    >
                      <span className="text-sm">{item.label}</span>
                      {item.sublabel ? (
                        <span className="text-muted-foreground text-xs">
                          {item.sublabel}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground px-3 py-4 text-sm">
              No matches for “{query.trim()}”.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
