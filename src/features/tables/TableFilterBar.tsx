"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTableParams } from "@/features/tables/useTableParams";

/**
 * Shared list filter bar (Phase 5, §31). Drives the URL-param table state via
 * {@link useTableParams} — every filter is one of the entity's *indexed* columns
 * (`status`, `assignedToId`, `sourceId`/`categoryId`, …) so each combination
 * stays a single fast query (§37). Select filters apply on change; the free-text
 * search applies on submit/Enter to avoid a query per keystroke.
 */

export type FilterDef =
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "search"; placeholder?: string };

export function TableFilterBar({
  filters,
  values,
  className,
}: {
  filters: FilterDef[];
  values: Record<string, string>;
  className?: string;
}) {
  const { setFilter } = useTableParams();

  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      {filters.map((filter) => {
        if (filter.type === "select") {
          return (
            <div key={filter.key} className="space-y-1">
              <label
                htmlFor={`filter-${filter.key}`}
                className="text-muted-foreground block text-xs font-medium"
              >
                {filter.label}
              </label>
              <select
                id={`filter-${filter.key}`}
                value={values[filter.key] ?? ""}
                onChange={(e) => setFilter(filter.key, e.target.value)}
                className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="">All</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        return (
          <SearchFilter
            key={filter.key}
            filterKey={filter.key}
            label={filter.label}
            placeholder={filter.placeholder}
            initialValue={values[filter.key] ?? ""}
            onApply={(value) => setFilter(filter.key, value)}
          />
        );
      })}
    </div>
  );
}

function SearchFilter({
  filterKey,
  label,
  placeholder,
  initialValue,
  onApply,
}: {
  filterKey: string;
  label: string;
  placeholder?: string;
  initialValue: string;
  onApply: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(value.trim());
      }}
    >
      <label
        htmlFor={`filter-${filterKey}`}
        className="text-muted-foreground block text-xs font-medium"
      >
        {label}
      </label>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          id={`filter-${filterKey}`}
          value={value}
          placeholder={placeholder ?? "Search…"}
          onChange={(e) => setValue(e.target.value)}
          className="w-56 pl-8"
        />
      </div>
    </form>
  );
}
