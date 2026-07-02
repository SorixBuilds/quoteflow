import { Text, View } from "@react-pdf/renderer";

import type { DocStyles } from "@/lib/pdf/components/styles";

/**
 * Document footer (§10.2) — configurable footer text on the left and live page
 * numbering on the right. `fixed` so it appears on every page; the page numbers
 * use `@react-pdf`'s `render` callback so they are correct across multi-page
 * documents.
 */
export function PdfFooter({ text, styles }: { text: string; styles: DocStyles }) {
  return (
    <View style={styles.footer} fixed>
      {text ? <Text style={styles.footerText}>{text}</Text> : <Text style={styles.footerText} />}
      <Text
        style={styles.footerPage}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}
