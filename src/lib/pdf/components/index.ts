/**
 * Shared PDF component primitives (Phase 6, §10.4). Reused across all five
 * document templates and any future document type.
 */
export { createDocStyles, type DocStyles } from "@/lib/pdf/components/styles";
export { DocumentShell } from "@/lib/pdf/components/DocumentShell";
export { PdfHeader } from "@/lib/pdf/components/PdfHeader";
export { PdfFooter } from "@/lib/pdf/components/PdfFooter";
export { PdfWatermark } from "@/lib/pdf/components/PdfWatermark";
export { PdfTable, type PdfColumn } from "@/lib/pdf/components/PdfTable";
export { PdfPartyBlock } from "@/lib/pdf/components/PdfPartyBlock";
export { PdfTotals, type TotalsLine } from "@/lib/pdf/components/PdfTotals";
export { PdfSection } from "@/lib/pdf/components/PdfSection";
export { PdfSignature } from "@/lib/pdf/components/PdfSignature";
export { PdfMetaList, type MetaPair } from "@/lib/pdf/components/PdfMetaList";
