import { describe, expect, it } from "vitest";

import { CsvExporter } from "@/features/export/CsvExporter";
import { getExporter } from "@/features/export/Exporter";
import type { ColumnDef } from "@/features/tables/types";

type Row = { name: string; note: string; total: number };

const columns: ColumnDef<Row>[] = [
  { key: "name", header: "Name", accessor: (r) => r.name, exportValue: (r) => r.name },
  { key: "note", header: "Note", accessor: (r) => r.note, exportValue: (r) => r.note },
  // A column with no exportValue must be omitted from the CSV.
  { key: "total", header: "Total", accessor: (r) => r.total },
];

describe("CsvExporter (Step 14)", () => {
  it("emits a header row from exportable columns only", async () => {
    const csv = await new CsvExporter().export([], columns as ColumnDef<unknown>[]);
    expect(csv).toBe("Name,Note");
  });

  it("escapes commas, quotes, and newlines per RFC 4180", async () => {
    const rows: Row[] = [
      { name: "Acme, Inc.", note: 'He said "hi"\nbye', total: 1 },
    ];
    const csv = await new CsvExporter().export(
      rows as unknown[],
      columns as ColumnDef<unknown>[],
    );
    expect(csv).toBe('Name,Note\r\n"Acme, Inc.","He said ""hi""\nbye"');
  });
});

describe("getExporter (Step 14/§18)", () => {
  it("returns the CSV exporter", () => {
    expect(getExporter("csv").format).toBe("csv");
  });

  it("throws a clear, documented error for reserved formats", () => {
    expect(() => getExporter("xlsx")).toThrow(/not yet available/);
    expect(() => getExporter("pdf")).toThrow(/not yet available/);
  });
});
