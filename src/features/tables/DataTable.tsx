"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, Download, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { cn } from "@/lib/utils";
import { useTableParams } from "@/features/tables/useTableParams";
import type { DataTableProps } from "@/features/tables/types";

/**
 * Reusable list table (Phase 4, §19). URL-driven sorting and pagination via
 * {@link useTableParams}; shared empty/loading/error states; accessible
 * sortable headers (`aria-sort`); an optional CSV export hook. Built on a native
 * `<table>` — no external table library (§DataTable framework constraint).
 *
 * Reserved props (savedFilters, columnVisibility, rowSelection, bulkActions,
 * columnPinning) are accepted by the type but intentionally not rendered yet.
 */
export function DataTable<T>({
  columns,
  rows,
  totalCount,
  page,
  pageSize,
  sortBy,
  sortDir,
  isLoading,
  error,
  getRowId,
  onExport,
}: DataTableProps<T>) {
  const { toggleSort, setPage } = useTableParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="space-y-3">
      {onExport ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onExport("csv")}
          >
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((col) => {
                const isSorted = sortBy === col.key;
                const ariaSort = isSorted
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";
                return (
                  <th
                    key={col.key}
                    aria-sort={col.sortable ? ariaSort : undefined}
                    className={cn(
                      "text-muted-foreground px-4 py-2.5 font-medium",
                      col.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="hover:text-foreground inline-flex items-center gap-1"
                      >
                        {col.header}
                        {isSorted ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : (
                            <ArrowDown className="size-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-50" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6">
                  <LoadingSkeleton lines={pageSize > 5 ? 5 : pageSize} />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6">
                  <ErrorState />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6">
                  <EmptyState icon={Inbox} title="No results" />
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={getRowId ? getRowId(row) : index}
                  className="border-t"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-4 py-2.5",
                        col.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {totalCount} {totalCount === 1 ? "result" : "results"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
