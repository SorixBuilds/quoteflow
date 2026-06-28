"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/features/tables/DataTable";
import { TableFilterBar } from "@/features/tables/TableFilterBar";
import { createExportHandler } from "@/features/export/download";
import { CustomerForm } from "@/features/customers/components/CustomerForm";
import { createCustomer } from "@/features/customers/actions";
import type { CustomerListRow } from "@/features/customers/queries";
import type { ColumnDef } from "@/features/tables/types";
import type { TableParams } from "@/features/tables/types";

const TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "Individual",
  BUSINESS: "Business",
};

/** Customer list screen (Phase 5, §15, §31, §32). */
export function CustomerList({
  rows,
  totalCount,
  params,
}: {
  rows: CustomerListRow[];
  totalCount: number;
  params: TableParams;
}) {
  const [creating, setCreating] = useState(false);

  const columns: ColumnDef<CustomerListRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      accessor: (row) => (
        <Link href={`/customers/${row.id}`} className="text-primary font-medium hover:underline">
          {row.name}
        </Link>
      ),
      exportValue: (row) => row.name,
    },
    {
      key: "type",
      header: "Type",
      accessor: (row) => TYPE_LABELS[row.type] ?? row.type,
      exportValue: (row) => TYPE_LABELS[row.type] ?? row.type,
    },
    {
      key: "email",
      header: "Email",
      accessor: (row) => row.email ?? "—",
      exportValue: (row) => row.email ?? "",
    },
    {
      key: "phone",
      header: "Phone",
      accessor: (row) => row.phone ?? "—",
      exportValue: (row) => row.phone ?? "",
    },
    {
      key: "createdAt",
      header: "Added",
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
            { key: "name", label: "Search", type: "search", placeholder: "Name…" },
            {
              key: "type",
              label: "Type",
              type: "select",
              options: [
                { value: "INDIVIDUAL", label: "Individual" },
                { value: "BUSINESS", label: "Business" },
              ],
            },
          ]}
          values={params.filters}
        />
        <Button type="button" onClick={() => setCreating((v) => !v)}>
          {creating ? "Close" : "New customer"}
        </Button>
      </div>

      {creating ? (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="mb-4 text-base font-semibold">New customer</h2>
          <CustomerForm
            onSubmit={createCustomer}
            onCancel={() => setCreating(false)}
            onDone={() => setCreating(false)}
          />
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        totalCount={totalCount}
        page={params.page}
        pageSize={params.pageSize}
        sortBy={params.sortBy}
        sortDir={params.sortDir}
        getRowId={(row) => row.id}
        onExport={createExportHandler(rows, columns, "customers.csv")}
      />
    </div>
  );
}
