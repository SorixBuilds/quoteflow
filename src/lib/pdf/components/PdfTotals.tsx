import { Text, View } from "@react-pdf/renderer";

import type { DocStyles } from "@/lib/pdf/components/styles";

/** One subtotal/tax/discount line in the totals box. */
export type TotalsLine = { label: string; value: string };

/**
 * Right-aligned totals box (§10.2) — subtotal, discount, tax lines followed by a
 * brand-emphasized grand total, and optional trailing lines (e.g. Amount Paid /
 * Balance Due on an invoice). Shared by Quote/Invoice/Receipt templates.
 */
export function PdfTotals({
  lines,
  grandTotal,
  trailing = [],
  styles,
}: {
  lines: TotalsLine[];
  grandTotal: TotalsLine;
  trailing?: TotalsLine[];
  styles: DocStyles;
}) {
  return (
    <View style={styles.totals}>
      <View style={styles.totalsBox}>
        {lines.map((line) => (
          <View key={line.label} style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{line.label}</Text>
            <Text style={styles.totalsValue}>{line.value}</Text>
          </View>
        ))}
        <View style={styles.grandTotalRow}>
          <Text style={styles.grandTotalLabel}>{grandTotal.label}</Text>
          <Text style={styles.grandTotalValue}>{grandTotal.value}</Text>
        </View>
        {trailing.map((line) => (
          <View key={line.label} style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{line.label}</Text>
            <Text style={styles.totalsValue}>{line.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
