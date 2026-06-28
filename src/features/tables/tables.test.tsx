import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { parseTableParams } from "@/features/tables/buildPrismaQuery";
import { DataTable } from "@/features/tables/DataTable";
import type { ColumnDef, DataTableProps } from "@/features/tables/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/leads",
  useSearchParams: () => new URLSearchParams(),
}));

describe("parseTableParams (Step 13)", () => {
  it("computes skip/take from page and pageSize", () => {
    const q = parseTableParams({ page: "3", pageSize: "10" });
    expect(q.skip).toBe(20);
    expect(q.take).toBe(10);
  });

  it("clamps pageSize to maxPageSize and defaults invalid input", () => {
    expect(parseTableParams({ pageSize: "5000" }, { maxPageSize: 100 }).take).toBe(100);
    expect(parseTableParams({ page: "-1" }).skip).toBe(0);
  });

  it("only sorts on allowlisted columns", () => {
    expect(
      parseTableParams({ sortBy: "name", sortDir: "asc" }, { allowedSort: ["name"] })
        .orderBy,
    ).toEqual({ name: "asc" });
    // not in allowlist → ignored
    expect(
      parseTableParams({ sortBy: "passwordHash" }, { allowedSort: ["name"] }).orderBy,
    ).toBeUndefined();
  });

  it("only filters on allowlisted columns, case-insensitive contains", () => {
    const q = parseTableParams(
      { name: "ali", secret: "x" },
      { allowedFilters: ["name"] },
    );
    expect(q.where).toEqual({ name: { contains: "ali", mode: "insensitive" } });
    expect(q.params.filters).toEqual({ name: "ali" });
  });
});

type Row = { id: string; name: string };
const columns: ColumnDef<Row>[] = [
  { key: "name", header: "Name", accessor: (r) => r.name, sortable: true },
];

const baseProps: DataTableProps<Row> = {
  columns,
  rows: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  getRowId: (r) => r.id,
};

describe("DataTable states (Step 13)", () => {
  it("renders the empty state", () => {
    render(<DataTable {...baseProps} />);
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("renders the loading state", () => {
    render(<DataTable {...baseProps} isLoading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders the error state", () => {
    render(<DataTable {...baseProps} error />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders rows with an accessible sortable header", () => {
    render(
      <DataTable
        {...baseProps}
        rows={[{ id: "1", name: "Ada" }]}
        totalCount={1}
        sortBy="name"
        sortDir="asc"
      />,
    );
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /name/i }),
    ).toHaveAttribute("aria-sort", "ascending");
  });

  it("exposes an export hook when onExport is provided", () => {
    render(<DataTable {...baseProps} onExport={() => {}} />);
    expect(
      screen.getByRole("button", { name: /export csv/i }),
    ).toBeInTheDocument();
  });
});

describe("reserved prop contract (Step 13/§19)", () => {
  it("accepts the typed-but-unimplemented props at compile time", () => {
    // Type-level guarantee: this object must compile against DataTableProps.
    const props: DataTableProps<Row> = {
      ...baseProps,
      savedFilters: [{ id: "f1", name: "Mine", filters: { name: "a" } }],
      columnVisibility: { name: true },
      rowSelection: { selectedIds: [], onChange: () => {} },
      bulkActions: [{ id: "del", label: "Delete", run: () => {} }],
      columnPinning: { left: ["name"] },
    };
    expect(props.savedFilters).toHaveLength(1);
  });
});
