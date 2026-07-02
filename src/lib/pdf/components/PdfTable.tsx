import { Text, View } from "@react-pdf/renderer";

import type { DocStyles } from "@/lib/pdf/components/styles";

/** A column definition: a key into each row, a header label, a width %, alignment. */
export type PdfColumn<R> = {
  key: keyof R & string;
  header: string;
  /** CSS width string, e.g. "50%". Columns should sum to 100%. */
  width: string;
  align?: "left" | "right" | "center";
};

/**
 * Generic, reusable line-item table (§10.2) — the same component renders the
 * Quote/Invoice line items and the Job Sheet/Work Order scope list. Rows flow
 * across pages automatically (the header is not fixed; each row is kept whole via
 * `wrap={false}`), and zebra striping aids readability on long lists.
 */
export function PdfTable<R extends Record<string, string>>({
  columns,
  rows,
  styles,
}: {
  columns: PdfColumn<R>[];
  rows: R[];
  styles: DocStyles;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        {columns.map((col) => (
          <Text
            key={col.key}
            style={[styles.tableHeaderCell, { width: col.width, textAlign: col.align ?? "left" }]}
          >
            {col.header}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View
          key={index}
          style={index % 2 === 1 ? styles.tableRowZebra : styles.tableRow}
          wrap={false}
        >
          {columns.map((col) => (
            <Text
              key={col.key}
              style={[styles.tableCell, { width: col.width, textAlign: col.align ?? "left" }]}
            >
              {row[col.key]}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
