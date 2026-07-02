import { Text, View } from "@react-pdf/renderer";

import type { DocStyles } from "@/lib/pdf/components/styles";

/**
 * A titled free-text block (Notes, Terms & Conditions, Scope of Work). Renders
 * nothing when the body is empty, so an absent terms/notes field simply omits
 * the section rather than leaving a stray heading.
 */
export function PdfSection({
  title,
  body,
  styles,
}: {
  title: string;
  body: string | null | undefined;
  styles: DocStyles;
}) {
  const text = (body ?? "").trim();
  if (!text) return null;
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{text}</Text>
    </View>
  );
}
