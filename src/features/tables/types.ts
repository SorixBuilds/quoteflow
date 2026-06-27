import type { ReactNode } from "react";

/**
 * Reusable DataTable contract (Phase 4, §19). The props implemented in Phase 4
 * (pagination/sort/filter/export) sit alongside a set of *typed but not yet
 * implemented* props (saved filters, column visibility, row selection, bulk
 * actions, column pinning), reserved now so Phase 5+ fills an agreed contract
 * rather than redesigning the prop surface mid-feature.
 */

export type SortDir = "asc" | "desc";

export type ColumnDef<T> = {
  /** Stable column id; also the sort key and filter key when applicable. */
  key: string;
  header: string;
  /** Cell renderer. */
  accessor: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
  /** Plain-text value for CSV export (Step 14); falls back to nothing if unset. */
  exportValue?: (row: T) => string;
};

export type TableParams = {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: SortDir;
  filters: Record<string, string>;
};

// --- Reserved Phase 5+ contract types (typed now, unused in Phase 4) ---------

export type SavedFilter = {
  id: string;
  name: string;
  filters: Record<string, string>;
};

export type BulkAction<T> = {
  id: string;
  label: string;
  run: (rows: T[]) => void;
};

export type ExportFormat = "csv" | "xlsx" | "pdf";

export type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  rows: T[];
  totalCount: number;

  // Implemented in Phase 4:
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDir?: SortDir;
  filters?: Record<string, string>;
  isLoading?: boolean;
  error?: boolean;
  /** Stable row id accessor (used by pagination keys; row selection later). */
  getRowId?: (row: T) => string;
  onExport?: (format: ExportFormat) => void;

  // Typed now, NOT implemented in Phase 4 — reserved so Phase 5+ doesn't
  // redesign the prop surface to add them (§19):
  savedFilters?: SavedFilter[];
  columnVisibility?: Record<string, boolean>;
  rowSelection?: { selectedIds: string[]; onChange: (ids: string[]) => void };
  bulkActions?: BulkAction<T>[];
  columnPinning?: { left?: string[]; right?: string[] };
};
