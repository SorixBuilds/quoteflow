import type { ReactElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";

import {
  PROVIDER_KEYS,
  ProviderNotConfiguredError,
  type Provider,
} from "@/lib/providers/types";
import { providerRegistry } from "@/lib/providers/registry";

/**
 * Document renderer contract + production implementation (Phase 6, §6.1, §10.6).
 *
 * `renderDocument()` (features/documents/render.ts) never calls
 * `@react-pdf/renderer` directly — it resolves a `DocumentRenderer` through the
 * provider registry and calls `render()`. Today there is exactly one
 * implementation (`ReactPdfRenderer`); the indirection means a future engine
 * swap (headless-browser HTML→PDF, an external render API) is a new adapter file
 * plus a one-line resolver change, never a change to a template or call site.
 *
 * Phase 6B Step 2 (this milestone) installs `@react-pdf/renderer` and makes
 * `ReactPdfRenderer` the resolved default, replacing the Phase 6A
 * `UnconfiguredDocumentRenderer` placeholder. The interface, the registry key,
 * and the resolver signature are all unchanged from Phase 6A.
 */

export interface DocumentRenderer extends Provider {
  /** Turn a `@react-pdf/renderer` `<Document>` element into a PDF byte buffer. */
  render(element: ReactElement): Promise<Buffer>;
}

/**
 * The production renderer: a thin adapter over `@react-pdf/renderer`'s
 * `renderToBuffer`. It owns the only direct dependency on the PDF engine, so no
 * template or business module imports the SDK (the §6.1 no-SDK-leakage rule).
 */
export class ReactPdfRenderer implements DocumentRenderer {
  readonly name = "react-pdf";

  render(element: ReactElement): Promise<Buffer> {
    // The interface is intentionally generic (`ReactElement`); `renderToBuffer`
    // narrows to a `<Document>` element. Templates always pass a `<Document>`
    // root (via DocumentShell), so this cast is the single, contained bridge to
    // the engine's exact parameter type.
    return renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
  }
}

/**
 * The Phase 6A placeholder, retained as an explicit "engine not wired" fallback
 * (and for the foundation test). It is no longer the resolver default, but the
 * type keeps the `ProviderNotConfiguredError` contract available if a future
 * deployment ever needs to disable rendering deliberately.
 */
export class UnconfiguredDocumentRenderer implements DocumentRenderer {
  readonly name = "unconfigured";

  async render(_element: ReactElement): Promise<Buffer> {
    void _element;
    throw new ProviderNotConfiguredError(
      PROVIDER_KEYS.documentRenderer,
      "No document renderer is configured for this deployment.",
    );
  }
}

/**
 * Resolve the active renderer (registry-injectable; defaults to the production
 * `ReactPdfRenderer`). The registry override remains the single branch point for
 * a future engine swap or a test double.
 */
export function resolveDocumentRenderer(): DocumentRenderer {
  return providerRegistry.resolve(
    PROVIDER_KEYS.documentRenderer,
    () => new ReactPdfRenderer(),
  );
}
