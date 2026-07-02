import type { PdfBrand } from "@/lib/pdf/theme";

/**
 * Document subsystem types (Phase 6, §10). The five document types and the
 * pre-formatted, fully serializable view models the templates render. All money
 * and dates are formatted to strings in the load layer (server-side, currency-
 * aware) so each template is pure presentation — no `Decimal`, no locale logic,
 * deterministic output for the snapshot tests (§10.12).
 */

export type DocumentType = "quote" | "invoice" | "job-sheet" | "work-order" | "receipt";

export const DOCUMENT_TYPES: readonly DocumentType[] = [
  "quote",
  "invoice",
  "job-sheet",
  "work-order",
  "receipt",
];

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** A named party with pre-flattened address/contact lines. */
export type DocParty = { name: string; lines: string[] };

/** A right-aligned metadata pair. */
export type DocMeta = { key: string; value: string };

/** A single line-item row (all strings; money already formatted). */
export type DocItem = {
  description: string;
  quantity: string;
  unitPrice: string;
  tax: string;
  amount: string;
};

/** A totals/summary line. */
export type DocTotalLine = { label: string; value: string };

export interface QuoteDoc {
  number: string;
  status: string;
  watermark?: string;
  customer: DocParty;
  meta: DocMeta[];
  items: DocItem[];
  totalLines: DocTotalLine[];
  grandTotal: DocTotalLine;
  notes?: string | null;
  terms?: string | null;
}

export interface InvoiceDoc {
  number: string;
  status: string;
  watermark?: string;
  customer: DocParty;
  meta: DocMeta[];
  items: DocItem[];
  grandTotal: DocTotalLine;
  /** Amount Paid / Balance Due lines, shown beneath the invoice total. */
  trailing: DocTotalLine[];
  notes?: string | null;
}

/** Shared by Job Sheet (no pricing) and Work Order (priced + signature). */
export interface JobDoc {
  number: string;
  status: string;
  watermark?: string;
  customer: DocParty;
  meta: DocMeta[];
  items: DocItem[];
  /** Present for Work Orders (priced); omitted for the internal Job Sheet. */
  totalLines?: DocTotalLine[];
  grandTotal?: DocTotalLine;
  notes?: string | null;
  terms?: string | null;
}

export interface ReceiptDoc {
  number: string;
  watermark?: string;
  customer: DocParty;
  meta: DocMeta[];
  payments: { date: string; method: string; reference: string; amount: string }[];
  totalLines: DocTotalLine[];
  grandTotal: DocTotalLine;
}

/** The discriminated render model produced by the load layer, consumed by `resolveTemplate`. */
export type RenderModel =
  | { type: "quote"; brand: PdfBrand; doc: QuoteDoc }
  | { type: "invoice"; brand: PdfBrand; doc: InvoiceDoc }
  | { type: "job-sheet"; brand: PdfBrand; doc: JobDoc }
  | { type: "work-order"; brand: PdfBrand; doc: JobDoc }
  | { type: "receipt"; brand: PdfBrand; doc: ReceiptDoc };

/** A successfully rendered document: the bytes plus a download filename. */
export type RenderedDocument = { buffer: Buffer; filename: string };
