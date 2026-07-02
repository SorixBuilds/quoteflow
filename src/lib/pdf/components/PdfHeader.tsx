import { Image, Text, View } from "@react-pdf/renderer";

import type { PdfBrand } from "@/lib/pdf/theme";
import type { DocStyles } from "@/lib/pdf/components/styles";

/**
 * Branded document header (§10.2) — company identity on the left (logo when
 * configured and available, otherwise the company name), document title/number
 * and an optional status pill on the right. Shared by all five templates.
 */
export function PdfHeader({
  brand,
  styles,
  title,
  number,
  status,
}: {
  brand: PdfBrand;
  styles: DocStyles;
  title: string;
  number: string;
  status?: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {brand.showLogo && brand.logoUrl ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt prop
          <Image style={styles.logo} src={brand.logoUrl} />
        ) : (
          <Text style={styles.companyName}>{brand.companyName}</Text>
        )}
        {brand.headerText ? <Text style={styles.headerText}>{brand.headerText}</Text> : null}
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.docTitle}>{title}</Text>
        <Text style={styles.docNumber}>{number}</Text>
        {status ? <Text style={styles.statusPill}>{status}</Text> : null}
      </View>
    </View>
  );
}
