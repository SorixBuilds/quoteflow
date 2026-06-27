"use client";

import type { ColumnDef, ExportFormat } from "@/features/tables/types";
import { getExporter } from "@/features/export/Exporter";

/**
 * Browser download wiring (Phase 4, §18). The handler a list screen passes to
 * `<DataTable onExport={...} />`: it resolves the exporter (throwing for reserved
 * xlsx/pdf), builds the file, and triggers a download. Client-only (uses
 * `document`/`URL`).
 */
export async function exportRows<T>(
  format: ExportFormat,
  rows: T[],
  columns: ColumnDef<T>[],
  filename: string,
): Promise<void> {
  const exporter = getExporter<T>(format);
  const output = await exporter.export(rows, columns);
  const blob =
    output instanceof Blob
      ? output
      : new Blob([output], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Convenience: a ready-made `onExport` handler for a DataTable instance. */
export function createExportHandler<T>(
  rows: T[],
  columns: ColumnDef<T>[],
  filename: string,
): (format: ExportFormat) => void {
  return (format) => {
    void exportRows(format, rows, columns, filename);
  };
}
