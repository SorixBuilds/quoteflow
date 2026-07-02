import { StyleSheet } from "@react-pdf/renderer";

import type { PdfBrand } from "@/lib/pdf/theme";

/**
 * Shared document stylesheet factory (Phase 6, §10.4). Every template builds its
 * styles from one `PdfBrand` via this function, so spacing, typography, and the
 * brand-colored accents are identical across all five document types. Uses the
 * `@react-pdf/renderer` built-in Helvetica family — no external font asset to
 * register, keeping the renderer self-contained and the build asset-free.
 */
export function createDocStyles(brand: PdfBrand) {
  const { colors } = brand;
  return StyleSheet.create({
    page: {
      paddingTop: 40,
      paddingBottom: 64, // room for the fixed footer
      paddingHorizontal: 40,
      fontFamily: "Helvetica",
      fontSize: 10,
      lineHeight: 1.4,
      color: colors.text,
    },
    // Header
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 18,
      paddingBottom: 14,
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    headerLeft: { flexDirection: "column", maxWidth: 280 },
    logo: { maxWidth: 160, maxHeight: 54, objectFit: "contain", marginBottom: 6 },
    companyName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: colors.primary },
    headerText: { fontSize: 9, color: colors.muted, marginTop: 2 },
    headerRight: { flexDirection: "column", alignItems: "flex-end" },
    docTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: colors.primary },
    docNumber: { fontSize: 11, marginTop: 2 },
    statusPill: {
      marginTop: 6,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 3,
      backgroundColor: colors.accent,
      color: "#FFFFFF",
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
    },
    // Party / meta blocks
    metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
    partyBlock: { flexDirection: "column", maxWidth: 240 },
    blockLabel: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    partyName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
    partyLine: { fontSize: 9, color: colors.text },
    metaGrid: { flexDirection: "column", alignItems: "flex-end" },
    metaPair: { flexDirection: "row", marginBottom: 2 },
    metaKey: { fontSize: 9, color: colors.muted, marginRight: 6 },
    metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
    // Table
    table: { width: "100%", marginBottom: 14 },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: colors.primary,
      color: colors.tableHeaderText,
    },
    tableHeaderCell: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      paddingVertical: 6,
      paddingHorizontal: 6,
      color: colors.tableHeaderText,
    },
    tableRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tableRowZebra: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.zebra,
    },
    tableCell: { fontSize: 9, paddingVertical: 5, paddingHorizontal: 6 },
    // Totals
    totals: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 16 },
    totalsBox: { width: 220, flexDirection: "column" },
    totalsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 3,
    },
    totalsLabel: { fontSize: 10, color: colors.muted },
    totalsValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
    grandTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      marginTop: 4,
      borderTopWidth: 2,
      borderTopColor: colors.primary,
    },
    grandTotalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: colors.primary },
    grandTotalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: colors.primary },
    // Free-text sections
    section: { marginBottom: 12 },
    sectionTitle: {
      fontSize: 10,
      fontFamily: "Helvetica-Bold",
      color: colors.primary,
      marginBottom: 4,
    },
    sectionBody: { fontSize: 9, color: colors.text },
    // Signature
    signatureRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 36 },
    signatureBox: { width: 220, flexDirection: "column" },
    signatureLine: { borderTopWidth: 1, borderTopColor: colors.text, marginBottom: 4 },
    signatureLabel: { fontSize: 8, color: colors.muted, textTransform: "uppercase" },
    // Footer
    footer: {
      position: "absolute",
      bottom: 28,
      left: 40,
      right: 40,
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 6,
    },
    footerText: { fontSize: 8, color: colors.muted, maxWidth: 380 },
    footerPage: { fontSize: 8, color: colors.muted },
    // Watermark
    watermark: {
      position: "absolute",
      top: 280,
      left: 80,
      right: 0,
      transform: "rotate(-32deg)",
      fontSize: 110,
      fontFamily: "Helvetica-Bold",
      color: colors.watermark,
      opacity: 1,
    },
  });
}

export type DocStyles = ReturnType<typeof createDocStyles>;
