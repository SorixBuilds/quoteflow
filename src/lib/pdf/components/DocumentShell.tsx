import type { ReactNode } from "react";
import { Document, Page } from "@react-pdf/renderer";

import type { PdfBrand } from "@/lib/pdf/theme";
import type { DocStyles } from "@/lib/pdf/components/styles";
import { PdfHeader } from "@/lib/pdf/components/PdfHeader";
import { PdfFooter } from "@/lib/pdf/components/PdfFooter";
import { PdfWatermark } from "@/lib/pdf/components/PdfWatermark";

/**
 * The reusable page frame every template wraps its body in (§10.2, §10.13) —
 * `<Document>` + a wrapping A4 `<Page>` carrying the watermark (optional, fixed),
 * the branded header, the template body, and the fixed footer with page numbers.
 * A sixth document type only needs to supply a title/number and its body; the
 * print-safe frame, multi-page flow, and branding come for free.
 */
export function DocumentShell({
  brand,
  styles,
  title,
  number,
  status,
  watermark,
  children,
}: {
  brand: PdfBrand;
  styles: DocStyles;
  title: string;
  number: string;
  status?: string;
  watermark?: string;
  children: ReactNode;
}) {
  return (
    <Document title={`${title} ${number}`.trim()} author={brand.companyName}>
      <Page size="A4" style={styles.page} wrap>
        {watermark ? <PdfWatermark label={watermark} styles={styles} /> : null}
        <PdfHeader brand={brand} styles={styles} title={title} number={number} status={status} />
        {children}
        <PdfFooter text={brand.footerText} styles={styles} />
      </Page>
    </Document>
  );
}
