"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { SortDir } from "@/features/tables/types";

/**
 * URL-driven table state (Phase 4, §19). Table state lives entirely in the URL's
 * search params so a list view is shareable, bookmarkable, and back/forward
 * friendly. This hook reads the current values and writes updates via a shallow
 * `router.replace`, resetting to page 1 whenever sort or a filter changes.
 */
export function useTableParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setPage = useCallback(
    (page: number) => commit((p) => p.set("page", String(page))),
    [commit],
  );

  const setPageSize = useCallback(
    (pageSize: number) =>
      commit((p) => {
        p.set("pageSize", String(pageSize));
        p.set("page", "1");
      }),
    [commit],
  );

  const setSort = useCallback(
    (sortBy: string, sortDir: SortDir) =>
      commit((p) => {
        p.set("sortBy", sortBy);
        p.set("sortDir", sortDir);
        p.set("page", "1");
      }),
    [commit],
  );

  const setFilter = useCallback(
    (key: string, value: string) =>
      commit((p) => {
        if (value) p.set(key, value);
        else p.delete(key);
        p.set("page", "1");
      }),
    [commit],
  );

  /** Toggle a column's sort: asc → desc → (same column re-clicked) asc. */
  const toggleSort = useCallback(
    (key: string) => {
      const current = searchParams.get("sortBy");
      const dir = searchParams.get("sortDir");
      const nextDir: SortDir =
        current === key && dir === "asc" ? "desc" : "asc";
      setSort(key, nextDir);
    },
    [searchParams, setSort],
  );

  return { setPage, setPageSize, setSort, setFilter, toggleSort };
}
