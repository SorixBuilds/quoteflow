"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { DataTable } from "@/features/tables/DataTable";
import { TableFilterBar } from "@/features/tables/TableFilterBar";
import { createExportHandler } from "@/features/export/download";
import { INVOICE_STATUS_LABELS } from "@/lib/status";
import type { InvoiceListRow } from "@/features/invoices/queries";
import type { ColumnDef, TableParams } from "@/features/tables/types";

/** Invoice list screen (Phase 5, §21, §31, §32). */
export function InvoiceList({
  rows,
  totalCount,
  params,
}: {
  rows: InvoiceListRow[];
  totalCount: number;
  params: TableParams;
}) {
  const columns: ColumnDef<InvoiceListRow>[] = [
    {
      key: "invoiceNumber",
      header: "Invoice #",
      sortable: true,
      accessor: (row) => (
        <Link href={`/invoices/${row.id}`} className="text-primary font-medium hover:underline">
          {row.invoiceNumber}
        </Link>
      ),
      exportValue: (row) => row.invoiceNumber,
    },
    { key: "customer", header: "Customer", accessor: (row) => row.customerName, exportValue: (row) => row.customerName },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      accessor: (row) => <MoneyDisplay value={row.amount} currency={row.currency} />,
      exportValue: (row) => row.amount,
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      accessor: (row) => <MoneyDisplay value={row.balance} currency={row.currency} />,
      exportValue: (row) => row.balance,
    },
    {
      key: "status",
      header: "Status",
      accessor: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge status={row.status} variant="invoice" />
          {row.overdue ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>
          ) : null}
        </span>
      ),
      exportValue: (row) => `${INVOICE_STATUS_LABELS[row.status]}${row.overdue ? " (overdue)" : ""}`,
    },
    {
      key: "dueDate",
      header: "Due",
      sortable: true,
      accessor: (row) => (row.dueDate ? row.dueDate.toLocaleDateString() : "—"),
      exportValue: (row) => (row.dueDate ? row.dueDate.toISOString() : ""),
    },
  ];

  return (
    <div className="space-y-4">
      <TableFilterBar
        filters={[
          { key: "invoiceNumber", label: "Search", type: "search", placeholder: "Invoice #…" },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          },
        ]}
        values={params.filters}
      />

      <DataTable
        columns={columns}
        rows={rows}
        totalCount={totalCount}
        page={params.page}
        pageSize={params.pageSize}
        sortBy={params.sortBy}
        sortDir={params.sortDir}
        getRowId={(row) => row.id}
        onExport={createExportHandler(rows, columns, "invoices.csv")}
      />
    </div>
  );
}
