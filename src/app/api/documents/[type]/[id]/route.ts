import type { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/permissions";
import { logger } from "@/lib/logger";
import { renderDocument } from "@/features/documents/render";
import { isDocumentType } from "@/features/documents/types";

/**
 * Internal document render route (Phase 6, §10.6) — session-gated, NOT part of
 * the Public API. `GET /api/documents/[type]/[id]` streams a branded PDF for a
 * Quote/Invoice/Job/Receipt the caller is allowed to see.
 *
 * Security (§10.9): the organization id and role are taken from the session, never
 * the URL; `renderDocument` re-scopes every query to them and returns `null` for
 * anything outside scope, which becomes a 404 (we never confirm another tenant's
 * record exists, §10.10). Render runs on the Node runtime (the PDF engine needs
 * Node APIs) and is never cached (`no-store`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string; id: string }> },
): Promise<Response> {
  const { type, id } = await context.params;

  // Unknown type or malformed id → 404 (never reveal which it was).
  if (!isDocumentType(type) || !UUID.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await renderDocument(type, id, user);
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
    logger.error("Document render failed", {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response("Could not generate this document", { status: 500 });
  }
}
