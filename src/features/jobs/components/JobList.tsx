"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable } from "@/features/tables/DataTable";
import { TableFilterBar, type FilterDef } from "@/features/tables/TableFilterBar";
import { createExportHandler } from "@/features/export/download";
import { JOB_STATUS_LABELS } from "@/lib/status";
import type { JobListRow } from "@/features/jobs/queries";
import type { ColumnDef, TableParams } from "@/features/tables/types";

/** Job list screen (Phase 5, §20, §31, §32). */
export function JobList({
  rows,
  totalCount,
  params,
  canManage,
  technicians,
}: {
  rows: JobListRow[];
  totalCount: number;
  params: TableParams;
  canManage: boolean;
  technicians: { id: string; name: string }[];
}) {
  const columns: ColumnDef<JobListRow>[] = [
    {
      key: "quote",
      header: "Quote #",
      accessor: (row) => (
        <Link href={`/jobs/${row.id}`} className="text-primary font-medium hover:underline">
          {row.quoteNumber}
        </Link>
      ),
      exportValue: (row) => row.quoteNumber,
    },
    { key: "customer", header: "Customer", accessor: (row) => row.customerName, exportValue: (row) => row.customerName },
    {
      key: "scheduledDate",
      header: "Scheduled",
      sortable: true,
      accessor: (row) => (row.scheduledDate ? row.scheduledDate.toLocaleDateString() : "Unscheduled"),
      exportValue: (row) => (row.scheduledDate ? row.scheduledDate.toISOString() : ""),
    },
    {
      key: "status",
      header: "Status",
      accessor: (row) => <StatusBadge status={row.status} variant="job" />,
      exportValue: (row) => JOB_STATUS_LABELS[row.status],
    },
    {
      key: "assignee",
      header: "Technician",
      accessor: (row) => row.assigneeName ?? "—",
      exportValue: (row) => row.assigneeName ?? "",
    },
  ];

  const filters: FilterDef[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: Object.entries(JOB_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    },
  ];
  if (canManage && technicians.length > 0) {
    filters.push({
      key: "assignedToId",
      label: "Technician",
      type: "select",
      options: technicians.map((t) => ({ value: t.id, label: t.name })),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <TableFilterBar filters={filters} values={params.filters} />
        <Link href="/jobs/calendar" className={buttonVariants({ variant: "outline" })}>
          Calendar
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
        onExport={createExportHandler(rows, columns, "jobs.csv")}
      />
    </div>
  );
}
