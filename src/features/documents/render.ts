import type { SessionUser } from "@/features/auth/types";
import { resolveDocumentRenderer } from "@/lib/pdf/renderer";
import { loadRenderModel } from "@/features/documents/load";
import { resolveTemplate } from "@/features/documents/templates";
import type { DocumentType, RenderedDocument } from "@/features/documents/types";

/**
 * Document render service (Phase 6, §10.6, §10.7). The single entry point the
 * route handler (and, later, the Customer Portal) calls. It is a pure read
 * pipeline — scope → load (org/role-scoped) → resolve template → render — with
 * no write and no Activity log (rendering a PDF is not a business event, §10.7).
 *
 * The session is injected by the caller (the route resolves it and returns 401
 * when absent), which keeps this function unit-testable with a mock session and
 * a mocked `db`. Returns `null` when the entity is not found in the caller's
 * scope, so the route can answer 404 without confirming another tenant's record.
 */
export async function renderDocument(
  type: DocumentType,
  entityId: string,
  session: Pick<SessionUser, "id" | "organizationId" | "role">,
): Promise<RenderedDocument | null> {
  const model = await loadRenderModel(type, entityId, {
    organizationId: session.organizationId,
    role: session.role,
    userId: session.id,
  });
  if (!model) return null;

  const buffer = await resolveDocumentRenderer().render(resolveTemplate(model));
  return { buffer, filename: buildFilename(type, model.doc.number) };
}

/** A safe, descriptive download filename, e.g. `invoice-INV-001.pdf`. */
export function buildFilename(type: DocumentType, documentNumber: string): string {
  const safeNumber = documentNumber.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${type}-${safeNumber || "document"}.pdf`;
}
