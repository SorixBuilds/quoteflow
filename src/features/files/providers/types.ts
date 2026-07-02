import type { Provider } from "@/lib/providers/types";

/**
 * Storage provider contract (Phase 6, §14.6).
 *
 * The single interface the file-attachment workflow calls to turn an intended
 * attachment into a durable, fetchable `url` for the `FileAttachment` row. Phase
 * 6A ships the interface, the zero-cost default (`UrlPasteProvider` — same
 * pattern as the frozen `Organization.logoUrl`), and the resolver; the
 * `FileAttachment` CRUD that consumes it is Step 3 (§29). A funded
 * `VercelBlobProvider` (real binary upload) is one new file plus
 * `STORAGE_PROVIDER=vercel-blob` (§14.13) — no change to any caller.
 */

/**
 * What the caller wants stored. In URL-paste mode only `url`/`fileName` are
 * present; in a future binary mode `data` carries the bytes and the provider
 * returns the URL it uploaded them to.
 */
export interface StoreInput {
  fileName: string;
  /** A user-pasted URL (URL-paste mode) — the only mode in Phase 6A. */
  url?: string;
  /** Raw bytes (binary-upload mode) — accepted by the interface, used by a funded provider. */
  data?: ArrayBuffer | Uint8Array;
  mimeType?: string;
}

/** A stored file's durable reference, shaped to map straight onto `FileAttachment`. */
export interface StoredFile {
  url: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
}

export interface StorageProvider extends Provider {
  store(input: StoreInput): Promise<StoredFile>;
}
