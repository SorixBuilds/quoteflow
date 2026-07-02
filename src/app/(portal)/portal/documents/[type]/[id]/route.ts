import type { NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { renderDocument } from "@/features/documents/render";
import { isDocumentType } from "@/features/documents/types";
import { getPortalSession } from "@/features/customer-portal/session";
import { portalOwnsDocument } from "@/features/customer-portal/queries";

/**
 * Customer Portal document download (§10.6, §12.8). Streams a branded PDF for a
 * Quote/Invoice/Receipt the **portal session's own customer** owns.
 *
 * Security: the customer + organization come from the verified portal cookie,
 * never the URL. `portalOwnsDocument` re-derives ownership (`WHERE id = ? AND
 * organizationId = ? AND customerId = ?`) BEFORE rendering, so an id belonging to
 * another customer or org is a flat 404 — no enumeration, no cross-tenant render
 * (§12.9). Only after that check do we call the SAME `renderDocument()` the staff
 * app uses (§10.6 — one render path), scoped to the organization. Never cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string; id: string }> },
): Promise<Response> {
  const { type, id } = await context.params;

  if (!isDocumentType(type) || !UUID.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const session = await getPortalSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Ownership gate — the portal may only download its own customer's documents,
  // and only the customer-facing types (Quote/Invoice/Receipt; §12.5/§5).
  if (!(await portalOwnsDocument(session, type, id))) {
    return new Response("Not found", { status: 404 });
  }

  try {
    // Ownership already proven above; render under the organization scope using
    // the shared single render path (§10.6). Role OWNER is the org-wide read used
    // for these customer-facing types; `id` is unused by their loaders.
    const result = await renderDocument(type, id, {
      id: "portal",
      organizationId: session.organizationId,
      role: "OWNER",
    });
    if (!result) {
      return new Response("Not found", { status: 404 });
    }

    const asDownload = request.nextUrl.searchParams.has("download");
    const disposition = asDownload ? "attachment" : "inline";
    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${result.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    logger.error("Portal document render failed", {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Could not generate this document", { status: 500 });
  }
}
