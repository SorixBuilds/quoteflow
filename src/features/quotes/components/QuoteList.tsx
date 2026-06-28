"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { DataTable } from "@/features/tables/DataTable";
import { TableFilterBar } from "@/features/tables/TableFilterBar";
import { createExportHandler } from "@/features/export/download";
import { QUOTE_STATUS_LABELS } from "@/lib/status";
import type { QuoteListRow } from "@/features/quotes/queries";
import type { ColumnDef, TableParams } from "@/features/tables/types";

/** Quote list screen (Phase 5, §16, §31, §32). */
export function QuoteList({
  rows,
  totalCount,
  params,
}: {
  rows: QuoteListRow[];
  totalCount: number;
  params: TableParams;
}) {
  const columns: ColumnDef<QuoteListRow>[] = [
    {
      key: "quoteNumber",
      header: "Quote #",
      sortable: true,
      accessor: (row) => (
        <Link href={`/quotes/${row.id}`} className="text-primary font-medium hover:underline">
          {row.quoteNumber}
          {row.version > 1 ? <span className="text-muted-foreground"> v{row.version}</span> : null}
        </Link>
      ),
      exportValue: (row) => row.quoteNumber,
    },
    { key: "customer", header: "Customer", accessor: (row) => row.customerName, exportValue: (row) => row.customerName },
    {
      key: "status",
      header: "Status",
      accessor: (row) => <StatusBadge status={row.status} variant="quote" />,
      exportValue: (row) => QUOTE_STATUS_LABELS[row.status],
    },
    {
      key: "total",
      header: "Total",
      sortable: true,
      align: "right",
      accessor: (row) => <MoneyDisplay value={row.total} currency={row.currency} />,
      exportValue: (row) => row.total,
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      accessor: (row) => row.createdAt.toLocaleDateString(),
      exportValue: (row) => row.createdAt.toISOString(),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <TableFilterBar
          filters={[
            { key: "quoteNumber", label: "Search", type: "search", placeholder: "Quote #…" },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            },
          ]}
          values={params.filters}
        />
        <Link href="/quotes/new" className={buttonVariants()}>
          New quote
        </Link>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        totalCount={totalCount}
        page={params.page}
        pageSize={params.pageSize}
        sortBy={params.sortBy}
        sortDir={params.sortDir}
        getRowId={(row) => row.id}
        onExport={createExportHandler(rows, columns, "quotes.csv")}
      />
    </div>
  );
}
