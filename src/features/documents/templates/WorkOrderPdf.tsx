import { View } from "@react-pdf/renderer";

import type { PdfBrand } from "@/lib/pdf/theme";
import type { JobDoc, DocItem } from "@/features/documents/types";
import {
  DocumentShell,
  PdfMetaList,
  PdfPartyBlock,
  PdfSection,
  PdfSignature,
  PdfTable,
  PdfTotals,
  createDocStyles,
  type PdfColumn,
} from "@/lib/pdf/components";

const COLUMNS: PdfColumn<DocItem>[] = [
  { key: "description", header: "Description", width: "46%" },
  { key: "quantity", header: "Qty", width: "12%", align: "right" },
  { key: "unitPrice", header: "Unit Price", width: "18%", align: "right" },
  { key: "amount", header: "Amount", width: "24%", align: "right" },
];

/**
 * Work Order PDF (§10.2) — the customer-authorizing document for a Job: priced
 * scope, totals, terms, and a signature section. Rendered for OWNER/STAFF and
 * the assigned FIELD technician (§10.8).
 */
export function WorkOrderPdf({ brand, doc }: { brand: PdfBrand; doc: JobDoc }) {
  const styles = createDocStyles(brand);
  return (
    <DocumentShell
      brand={brand}
      styles={styles}
      title="WORK ORDER"
      number={doc.number}
      status={doc.status}
      watermark={doc.watermark}
    >
      <View style={styles.metaRow}>
        <PdfPartyBlock label="Customer" name={doc.customer.name} lines={doc.customer.lines} styles={styles} />
        <PdfMetaList pairs={doc.meta} styles={styles} />
      </View>

      <PdfTable columns={COLUMNS} rows={doc.items} styles={styles} />
      {doc.grandTotal ? (
        <PdfTotals lines={doc.totalLines ?? []} grandTotal={doc.grandTotal} styles={styles} />
      ) : null}

      <PdfSection title="Scope & Notes" body={doc.notes} styles={styles} />
      <PdfSection title="Terms & Conditions" body={doc.terms} styles={styles} />

      <PdfSignature styles={styles} />
    </DocumentShell>
  );
}
