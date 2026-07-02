import { View } from "@react-pdf/renderer";

import type { PdfBrand } from "@/lib/pdf/theme";
import type { ReceiptDoc } from "@/features/documents/types";
import {
  DocumentShell,
  PdfMetaList,
  PdfPartyBlock,
  PdfTable,
  PdfTotals,
  createDocStyles,
  type PdfColumn,
} from "@/lib/pdf/components";

type PaymentRow = { date: string; method: string; reference: string; amount: string };

const COLUMNS: PdfColumn<PaymentRow>[] = [
  { key: "date", header: "Date", width: "24%" },
  { key: "method", header: "Method", width: "22%" },
  { key: "reference", header: "Reference", width: "34%" },
  { key: "amount", header: "Amount", width: "20%", align: "right" },
];

/**
 * Payment Receipt PDF (§10.2) — confirms payments recorded against an invoice:
 * the payment lines, the invoice total, total paid, and remaining balance. A
 * "PAID" watermark stamps a fully-settled invoice. OWNER/STAFF only (§10.8).
 */
export function ReceiptPdf({ brand, doc }: { brand: PdfBrand; doc: ReceiptDoc }) {
  const styles = createDocStyles(brand);
  return (
    <DocumentShell
      brand={brand}
      styles={styles}
      title="RECEIPT"
      number={doc.number}
      watermark={doc.watermark}
    >
      <View style={styles.metaRow}>
        <PdfPartyBlock label="Received From" name={doc.customer.name} lines={doc.customer.lines} styles={styles} />
        <PdfMetaList pairs={doc.meta} styles={styles} />
      </View>

      <PdfTable columns={COLUMNS} rows={doc.payments} styles={styles} />
      <PdfTotals lines={doc.totalLines} grandTotal={doc.grandTotal} styles={styles} />
    </DocumentShell>
  );
}
