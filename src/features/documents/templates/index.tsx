import type { ReactElement } from "react";

import type { RenderModel } from "@/features/documents/types";
import { QuotePdf } from "@/features/documents/templates/QuotePdf";
import { InvoicePdf } from "@/features/documents/templates/InvoicePdf";
import { JobSheetPdf } from "@/features/documents/templates/JobSheetPdf";
import { WorkOrderPdf } from "@/features/documents/templates/WorkOrderPdf";
import { ReceiptPdf } from "@/features/documents/templates/ReceiptPdf";

/**
 * Map a loaded render model to its template element (§10.6, §10.13). This `switch`
 * is the single place document type maps to template; a sixth type is one new
 * case plus one new template file — no change to `render.ts`, the route, or any
 * existing template.
 */
export function resolveTemplate(model: RenderModel): ReactElement {
  switch (model.type) {
    case "quote":
      return <QuotePdf brand={model.brand} doc={model.doc} />;
    case "invoice":
      return <InvoicePdf brand={model.brand} doc={model.doc} />;
    case "job-sheet":
      return <JobSheetPdf brand={model.brand} doc={model.doc} />;
    case "work-order":
      return <WorkOrderPdf brand={model.brand} doc={model.doc} />;
    case "receipt":
      return <ReceiptPdf brand={model.brand} doc={model.doc} />;
  }
}

export { QuotePdf, InvoicePdf, JobSheetPdf, WorkOrderPdf, ReceiptPdf };
