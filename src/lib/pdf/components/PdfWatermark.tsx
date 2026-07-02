import { Text } from "@react-pdf/renderer";

import type { DocStyles } from "@/lib/pdf/components/styles";

/**
 * Diagonal watermark stamp (e.g. "DRAFT", "PAID", "VOID") — §10.2. `fixed` so it
 * repeats on every page of a multi-page document, behind the content, in the
 * pale brand wash from the theme so it never obscures text.
 */
export function PdfWatermark({ label, styles }: { label: string; styles: DocStyles }) {
  return (
    <Text style={styles.watermark} fixed>
      {label}
    </Text>
  );
}
