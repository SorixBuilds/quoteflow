import { z } from "zod";

/**
 * File reference contract (Phase 4, §16). A single abstraction for "a file is
 * associated with a record," independent of where the file lives. V1 is the
 * URL-paste pattern (used by `Organization.logoUrl`); the future Vercel Blob
 * path adds `mimeType`/`sizeBytes`/`uploadedBy`/`uploadedAt` to this same shape
 * without reworking any consumer (deferred).
 */
export type FileRef = {
  url: string;
  label?: string;
};

/** A pasted file URL: a valid http(s) URL, or empty to clear it. */
export const fileUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid URL (https://…).")
  .or(z.literal(""));

/** Whether a URL looks like a directly-previewable image (best-effort, V1). */
export function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(url.trim());
}
