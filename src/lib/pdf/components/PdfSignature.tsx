import { Text, View } from "@react-pdf/renderer";

import type { DocStyles } from "@/lib/pdf/components/styles";

/**
 * Signature section (§10.2, Work Order) — two sign-off lines (customer + company
 * representative) with a date line, for documents that authorize work.
 */
export function PdfSignature({
  styles,
  leftLabel = "Customer signature",
  rightLabel = "Authorized representative",
}: {
  styles: DocStyles;
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <View style={styles.signatureRow}>
      <View style={styles.signatureBox}>
        <View style={styles.signatureLine} />
        <Text style={styles.signatureLabel}>{leftLabel}</Text>
        <View style={[styles.signatureLine, { marginTop: 24 }]} />
        <Text style={styles.signatureLabel}>Date</Text>
      </View>
      <View style={styles.signatureBox}>
        <View style={styles.signatureLine} />
        <Text style={styles.signatureLabel}>{rightLabel}</Text>
        <View style={[styles.signatureLine, { marginTop: 24 }]} />
        <Text style={styles.signatureLabel}>Date</Text>
      </View>
    </View>
  );
}
