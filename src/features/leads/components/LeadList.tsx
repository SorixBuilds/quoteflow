"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/features/tables/DataTable";
import { TableFilterBar } from "@/features/tables/TableFilterBar";
import { createExportHandler } from "@/features/export/download";
import { LeadForm } from "@/features/leads/components/LeadForm";
import { createLead } from "@/features/leads/actions";
import { LEAD_STATUS_LABELS } from "@/lib/status";
import type { LeadListRow } from "@/features/leads/queries";
import type { ColumnDef, TableParams } from "@/features/tables/types";

type Option = { id: string; name: string };

/** Lead list screen (Phase 5, §14, §31, §32). */
export function LeadList({
  rows,
  totalCount,
  params,
  sources,
  staff,
}: {
  rows: LeadListRow[];
  totalCount: number;
  params: TableParams;
  sources: Option[];
  staff: Option[];
}) {
  const [creating, setCreating] = useState(false);

  const columns: ColumnDef<LeadListRow>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      accessor: (row) => (
        <Link href={`/leads/${row.id}`} className="text-primary font-medium hover:underline">
          {row.name}
        </Link>
      ),
      exportValue: (row) => row.name,
    },
    { key: "phone", header: "Phone", accessor: (row) => row.phone, exportValue: (row) => row.phone },
    {
      key: "source",
      header: "Source",
      accessor: (row) => row.sourceName ?? "—",
      exportValue: (row) => row.sourceName ?? "",
    },
    {
      key: "status",
      header: "Status",
      accessor: (row) => <StatusBadge status={row.status} variant="lead" />,
      exportValue: (row) => LEAD_STATUS_LABELS[row.status],
    },
    {
      key: "assignee",
      header: "Assigned to",
      accessor: (row) => row.assigneeName ?? "—",
      exportValue: (row) => row.assigneeName ?? "",
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
            { key: "name", label: "Search", type: "search", placeholder: "Name…" },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            },
            {
              key: "sourceId",
              label: "Source",
              type: "select",
              options: sources.map((s) => ({ value: s.id, label: s.name })),
            },
            {
              key: "assignedToId",
              label: "Assignee",
              type: "select",
              options: staff.map((s) => ({ value: s.id, label: s.name })),
            },
          ]}
          values={params.filters}
        />
        <Button type="button" onClick={() => setCreating((v) => !v)}>
          {creating ? "Close" : "New lead"}
        </Button>
      </div>

      {creating ? (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="mb-4 text-base font-semibold">New lead</h2>
          <LeadForm
            sources={sources}
            staff={staff}
            onSubmit={createLead}
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
        onExport={createExportHandler(rows, columns, "leads.csv")}
      />
    </div>
  );
}
