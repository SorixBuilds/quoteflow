import { Text, View } from "@react-pdf/renderer";

import type { DocStyles } from "@/lib/pdf/components/styles";

/** A key/value metadata pair (e.g. "Issued: 28 Jun 2026"). */
export type MetaPair = { key: string; value: string };

/**
 * A right-aligned stack of document metadata pairs (issue date, expiry, due
 * date, etc.). Empty values are skipped. Shared across the templates' meta rows.
 */
export function PdfMetaList({ pairs, styles }: { pairs: MetaPair[]; styles: DocStyles }) {
  return (
    <View style={styles.metaGrid}>
      {pairs
        .filter((p) => p.value)
        .map((pair) => (
          <View key={pair.key} style={styles.metaPair}>
            <Text style={styles.metaKey}>{pair.key}</Text>
            <Text style={styles.metaValue}>{pair.value}</Text>
          </View>
        ))}
    </View>
  );
}
