import { describe, expect, it } from "vitest";

import { ReactPdfRenderer } from "@/lib/pdf/renderer";
import { resolveTemplate } from "@/features/documents/templates";
import type { PdfBrand } from "@/lib/pdf/theme";
import type { DocItem, RenderModel } from "@/features/documents/types";

/**
 * Render smoke tests (§10.12). Each template renders a fixed sample to a real
 * PDF byte buffer through the production `ReactPdfRenderer`, exercising the
 * branding, watermark, totals, multi-page, and signature code paths without a
 * database. We assert the output is a well-formed, non-trivial PDF (the `%PDF`
 * magic header) rather than a brittle byte-for-byte snapshot, since the engine
 * embeds font subsets that legitimately vary.
 */

const brand: PdfBrand = {
  companyName: "Acme Plumbing Co.",
  logoUrl: null,
  showLogo: false,
  headerText: "Licensed & insured — Lic #12345",
  footerText: "Thank you for your business.",
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
  colors: {
    primary: "#16243B",
    accent: "#F2994A",
    text: "#1A1A1A",
    muted: "#6B7280",
    border: "#D1D5DB",
    tableHeaderText: "#FFFFFF",
    watermark: "#FDEBD5",
    zebra: "#F5F6F8",
  },
};

function items(count: number): DocItem[] {
  return Array.from({ length: count }, (_, i) => ({
    description: `Service line item ${i + 1} — detailed description of the work performed`,
    quantity: String((i % 5) + 1),
    unitPrice: "$120.00",
    tax: "GST 10%",
    amount: "$120.00",
  }));
}

const customer = {
  name: "Jordan Rivera",
  lines: ["jordan@example.com", "(555) 123-4567", "12 King St", "Springfield, IL"],
};

const models: Record<string, RenderModel> = {
  // 60 items forces a multi-page render (page numbering + fixed footer/watermark).
  quote: {
    type: "quote",
    brand,
    doc: {
      number: "QUO-001",
      status: "DRAFT",
      watermark: "DRAFT",
      customer,
      meta: [{ key: "Issued", value: "28 Jun 2026" }],
      items: items(60),
      totalLines: [
        { label: "Subtotal", value: "$7,200.00" },
        { label: "Discount (10%)", value: "-$720.00" },
        { label: "Tax", value: "$648.00" },
      ],
      grandTotal: { label: "Total", value: "$7,128.00" },
      notes: "Please review and approve.",
      terms: "Valid for 30 days.",
    },
  },
  invoice: {
    type: "invoice",
    brand,
    doc: {
      number: "INV-001",
      status: "PAID",
      watermark: "PAID",
      customer,
      meta: [{ key: "Due", value: "15 Jul 2026" }],
      items: items(3),
      grandTotal: { label: "Invoice Total", value: "$360.00" },
      trailing: [
        { label: "Amount Paid", value: "$360.00" },
        { label: "Balance Due", value: "$0.00" },
      ],
      notes: null,
    },
  },
  "job-sheet": {
    type: "job-sheet",
    brand,
    doc: {
      number: "QUO-001",
      status: "SCHEDULED",
      customer,
      meta: [{ key: "Technician", value: "Sam Field" }],
      items: items(4),
      notes: "Bring extra fittings.",
    },
  },
  "work-order": {
    type: "work-order",
    brand,
    doc: {
      number: "QUO-001",
      status: "IN_PROGRESS",
      customer,
      meta: [{ key: "Technician", value: "Sam Field" }],
      items: items(4),
      totalLines: [
        { label: "Subtotal", value: "$480.00" },
        { label: "Tax", value: "$48.00" },
      ],
      grandTotal: { label: "Total", value: "$528.00" },
      notes: "Customer to authorize on arrival.",
      terms: "Work authorized as scoped.",
    },
  },
  receipt: {
    type: "receipt",
    brand,
    doc: {
      number: "INV-001",
      watermark: "PAID",
      customer,
      meta: [{ key: "Invoice", value: "INV-001" }],
      payments: [
        { date: "01 Jul 2026", method: "CARD", reference: "ch_123", amount: "$200.00" },
        { date: "10 Jul 2026", method: "CASH", reference: "—", amount: "$160.00" },
      ],
      totalLines: [
        { label: "Invoice Total", value: "$360.00" },
        { label: "Balance Due", value: "$0.00" },
      ],
      grandTotal: { label: "Total Paid", value: "$360.00" },
    },
  },
};

describe("document templates render to valid PDFs (§10.12)", () => {
  const renderer = new ReactPdfRenderer();

  for (const [name, model] of Object.entries(models)) {
    it(`renders the ${name} template to a non-trivial PDF buffer`, async () => {
      const buffer = await renderer.render(resolveTemplate(model));
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
      expect(buffer.length).toBeGreaterThan(1000);
    }, 20_000);
  }
});
