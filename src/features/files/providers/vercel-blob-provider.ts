import { ProviderNotConfiguredError } from "@/lib/providers/types";
import { PROVIDER_KEYS } from "@/lib/providers/types";
import type {
  StorageProvider,
  StoredFile,
  StoreInput,
} from "@/features/files/providers/types";

/**
 * The funded binary-storage adapter (Phase 6, §14.9, §14.13).
 *
 * Written now, NOT wired — exactly as the architecture's folder structure marks
 * it ("vercel-blob-provider.ts # written, NOT wired — Section 14.13"). It carries
 * the upload-hardening rules the funded path will enforce (per-organization path
 * prefix, MIME allow-list, size ceiling) as real, tested pure functions, so the
 * security model is *designed now and reviewable now*. The one thing deferred is
 * the actual byte upload, which needs the `@vercel/blob` SDK — and §14.13 names
 * installing that package as the explicit funding trigger. Until then `store()`
 * raises a clear {@link ProviderNotConfiguredError} rather than pretending to
 * store anything.
 *
 * Critically, this file imports no SDK: selecting `STORAGE_PROVIDER=vercel-blob`
 * before the package exists fails loudly and safely, and no `@vercel/blob` symbol
 * ever leaks into business code. Swapping the zero-cost `UrlPasteProvider` for
 * this one is a one-line resolver change plus `npm i @vercel/blob` — no change to
 * `attachFile()`, the `FileAttachment` schema, or any detail page (§14.13).
 */

/** Default ceiling for a single uploaded file (10 MB) — enforced before storage. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * MIME types accepted for binary upload. Job photos, before/after images, and
 * the common document formats a trade business attaches — deliberately a
 * conservative allow-list (deny by default), never a deny-list.
 */
export const ALLOWED_UPLOAD_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIME)[number];

/** Whether a MIME type is permitted for binary upload (case-insensitive). */
export function isAllowedUploadMime(mimeType: string | undefined): mimeType is AllowedUploadMime {
  if (!mimeType) return false;
  const normalized = mimeType.trim().toLowerCase();
  return (ALLOWED_UPLOAD_MIME as readonly string[]).includes(normalized);
}

/** Whether a byte length is within the upload ceiling (and present). */
export function isWithinSizeLimit(sizeBytes: number | undefined): boolean {
  return typeof sizeBytes === "number" && sizeBytes >= 0 && sizeBytes <= MAX_UPLOAD_BYTES;
}

/**
 * The per-organization object-key prefix every uploaded blob is scoped under, so
 * one tenant's files can never collide with or be enumerated from another's
 * (§14.9). Pure and deterministic — unit-testable without the SDK.
 */
export function organizationBlobPrefix(organizationId: string): string {
  return `org/${organizationId}/`;
}

/** Byte length of a payload, normalizing the two accepted shapes. */
export function byteLength(data: ArrayBuffer | Uint8Array): number {
  return data instanceof Uint8Array ? data.byteLength : data.byteLength;
}

export class VercelBlobProvider implements StorageProvider {
  readonly name = "vercel-blob";

  constructor(private readonly organizationId?: string) {}

  async store(input: StoreInput): Promise<StoredFile> {
    // Validation that WILL gate the real upload, runnable today (defense in depth,
    // mirroring UrlPasteProvider keeping its rule inside the provider, §5.5).
    if (!input.data) {
      // A funded upload must carry bytes; a bare URL belongs to UrlPasteProvider.
      throw new ProviderNotConfiguredError(
        PROVIDER_KEYS.storage,
        "VercelBlobProvider received no file bytes to upload.",
      );
    }
    if (!isAllowedUploadMime(input.mimeType)) {
      throw new ProviderNotConfiguredError(
        PROVIDER_KEYS.storage,
        `Unsupported file type${input.mimeType ? ` (${input.mimeType})` : ""}.`,
      );
    }
    if (!isWithinSizeLimit(byteLength(input.data))) {
      throw new ProviderNotConfiguredError(
        PROVIDER_KEYS.storage,
        "File exceeds the 10 MB upload limit.",
      );
    }

    // The byte upload itself is the deferred funding trigger (§14.13): it needs
    // the `@vercel/blob` SDK, which is intentionally not installed yet.
    throw new ProviderNotConfiguredError(
      PROVIDER_KEYS.storage,
      "Binary upload is not enabled in this build. Install @vercel/blob and " +
        "implement the upload call to activate STORAGE_PROVIDER=vercel-blob (§14.13).",
    );
  }
}
