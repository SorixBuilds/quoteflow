import { View } from "@react-pdf/renderer";

import type { PdfBrand } from "@/lib/pdf/theme";
import type { QuoteDoc, DocItem } from "@/features/documents/types";
import {
  DocumentShell,
  PdfMetaList,
  PdfPartyBlock,
  PdfSection,
  PdfTable,
  PdfTotals,
  createDocStyles,
  type PdfColumn,
} from "@/lib/pdf/components";

const COLUMNS: PdfColumn<DocItem>[] = [
  { key: "description", header: "Description", width: "44%" },
  { key: "quantity", header: "Qty", width: "12%", align: "right" },
  { key: "unitPrice", header: "Unit Price", width: "16%", align: "right" },
  { key: "tax", header: "Tax", width: "12%" },
  { key: "amount", header: "Amount", width: "16%", align: "right" },
];

/** Quote PDF (§10.2) — branded estimate with line items, totals, notes & terms. */
export function QuotePdf({ brand, doc }: { brand: PdfBrand; doc: QuoteDoc }) {
  const styles = createDocStyles(brand);
  return (
    <DocumentShell
      brand={brand}
      styles={styles}
      title="QUOTE"
      number={doc.number}
      status={doc.status}
      watermark={doc.watermark}
    >
      <View style={styles.metaRow}>
        <PdfPartyBlock label="Quote For" name={doc.customer.name} lines={doc.customer.lines} styles={styles} />
        <PdfMetaList pairs={doc.meta} styles={styles} />
      </View>

      <PdfTable columns={COLUMNS} rows={doc.items} styles={styles} />
      <PdfTotals lines={doc.totalLines} grandTotal={doc.grandTotal} styles={styles} />

      <PdfSection title="Notes" body={doc.notes} styles={styles} />
      <PdfSection title="Terms & Conditions" body={doc.terms} styles={styles} />
    </DocumentShell>
  );
}
