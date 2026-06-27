import type { ColumnDef } from "@/features/tables/types";
import type { Exporter } from "@/features/export/Exporter";

/**
 * CSV exporter (Phase 4, §18) — the only implemented Exporter. String-templated,
 * no new dependency. A column contributes to the export only if it defines an
 * `exportValue` (the visual `accessor` returns React nodes, not text). Fields
 * are RFC-4180 escaped: any value containing a comma, quote, or newline is
 * wrapped in quotes with embedded quotes doubled.
 */
export class CsvExporter implements Exporter<unknown> {
  readonly format = "csv" as const;

  async export(
    rows: unknown[],
    columns: ColumnDef<unknown>[],
  ): Promise<string> {
    const exportable = columns.filter((c) => typeof c.exportValue === "function");
    const header = exportable.map((c) => escapeCsv(c.header)).join(",");
    const lines = rows.map((row) =>
      exportable.map((c) => escapeCsv(c.exportValue!(row))).join(","),
    );
    return [header, ...lines].join("\r\n");
  }
}

function escapeCsv(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
