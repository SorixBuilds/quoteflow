import { View } from "@react-pdf/renderer";

import type { PdfBrand } from "@/lib/pdf/theme";
import type { JobDoc, DocItem } from "@/features/documents/types";
import {
  DocumentShell,
  PdfMetaList,
  PdfPartyBlock,
  PdfSection,
  PdfTable,
  createDocStyles,
  type PdfColumn,
} from "@/lib/pdf/components";

// Internal job sheet: scope + quantities, deliberately no pricing.
const COLUMNS: PdfColumn<DocItem>[] = [
  { key: "description", header: "Work Item", width: "78%" },
  { key: "quantity", header: "Qty", width: "22%", align: "right" },
];

/**
 * Job Sheet PDF (§10.2) — the internal, field-facing work list for a scheduled
 * Job: customer, schedule, assignee, and the scope of work (no prices). Rendered
 * for OWNER/STAFF and for the assigned FIELD technician (§10.8).
 */
export function JobSheetPdf({ brand, doc }: { brand: PdfBrand; doc: JobDoc }) {
  const styles = createDocStyles(brand);
  return (
    <DocumentShell
      brand={brand}
      styles={styles}
      title="JOB SHEET"
      number={doc.number}
      status={doc.status}
      watermark={doc.watermark}
    >
      <View style={styles.metaRow}>
        <PdfPartyBlock label="Customer" name={doc.customer.name} lines={doc.customer.lines} styles={styles} />
        <PdfMetaList pairs={doc.meta} styles={styles} />
      </View>

      <PdfTable columns={COLUMNS} rows={doc.items} styles={styles} />

      <PdfSection title="Job Notes" body={doc.notes} styles={styles} />
    </DocumentShell>
  );
}
