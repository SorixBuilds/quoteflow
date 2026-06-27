import type { ColumnDef, ExportFormat } from "@/features/tables/types";
import { CsvExporter } from "@/features/export/CsvExporter";

/**
 * Export framework (Phase 4, §18). One interface with a `format` discriminator
 * and a uniform `export(rows, columns)` contract. CSV is the only implementation
 * in Phase 4; Excel and PDF are reserved members of the same interface that
 * throw a clear, documented error if requested — so the first time a real format
 * arrives it's a single new file plus one registry line, not a refactor of every
 * call site.
 */
export interface Exporter<T> {
  format: ExportFormat;
  export(rows: T[], columns: ColumnDef<T>[]): Promise<Blob | string>;
}

const registry: Partial<Record<ExportFormat, Exporter<unknown>>> = {
  csv: new CsvExporter(),
  // xlsx: reserved — not implemented
  // pdf: reserved — not implemented
};

/** Resolve an exporter, or throw if the format is reserved/unavailable. */
export function getExporter<T>(format: ExportFormat): Exporter<T> {
  const exporter = registry[format];
  if (!exporter) {
    throw new Error(`Export format "${format}" is not yet available.`);
  }
  return exporter as unknown as Exporter<T>;
}
