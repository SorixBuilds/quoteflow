import { Text, View } from "@react-pdf/renderer";

import type { DocStyles } from "@/lib/pdf/components/styles";

/**
 * A labeled party block (e.g. "From" / "Bill To") — name in bold followed by
 * contact/address lines. Shared by every template's company- and
 * customer-information rendering (§10.2).
 */
export function PdfPartyBlock({
  label,
  name,
  lines,
  styles,
}: {
  label: string;
  name: string;
  lines: string[];
  styles: DocStyles;
}) {
  return (
    <View style={styles.partyBlock}>
      <Text style={styles.blockLabel}>{label}</Text>
      <Text style={styles.partyName}>{name}</Text>
      {lines.filter(Boolean).map((line, i) => (
        <Text key={i} style={styles.partyLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}
