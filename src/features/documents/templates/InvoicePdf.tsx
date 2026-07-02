import { View } from "@react-pdf/renderer";

import type { PdfBrand } from "@/lib/pdf/theme";
import type { InvoiceDoc, DocItem } from "@/features/documents/types";
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

/**
 * Invoice PDF (§10.2) — bills against a Job's accepted-quote scope. The totals
 * box shows the invoice-level figures (Invoice Total, Amount Paid, Balance Due),
 * since a Job may carry several invoices (deposit/progress/final).
 */
export function InvoicePdf({ brand, doc }: { brand: PdfBrand; doc: InvoiceDoc }) {
  const styles = createDocStyles(brand);
  return (
    <DocumentShell
      brand={brand}
      styles={styles}
      title="INVOICE"
      number={doc.number}
      status={doc.status}
      watermark={doc.watermark}
    >
      <View style={styles.metaRow}>
        <PdfPartyBlock label="Bill To" name={doc.customer.name} lines={doc.customer.lines} styles={styles} />
        <PdfMetaList pairs={doc.meta} styles={styles} />
      </View>

      <PdfTable columns={COLUMNS} rows={doc.items} styles={styles} />
      <PdfTotals lines={[]} grandTotal={doc.grandTotal} trailing={doc.trailing} styles={styles} />

      <PdfSection title="Notes" body={doc.notes} styles={styles} />
    </DocumentShell>
  );
}
