import { z } from "zod";

/**
 * File-attachment persistence validation (§7.2.2, §14). The `url` is validated to
 * an http(s) URL — the same scheme guard the Phase 6A `UrlPasteProvider` enforces
 * — so a `javascript:`/`data:`/`file:` URL can never be persisted. `category` is
 * a fixed, app-known set.
 */

export const FILE_CATEGORIES = [
  "PHOTO",
  "BEFORE",
  "AFTER",
  "DOCUMENT",
  "ATTACHMENT",
] as const;

export type FileCategory = (typeof FILE_CATEGORIES)[number];

const entityTypeEnum = z.enum([
  "LEAD",
  "QUOTE",
  "JOB",
  "CUSTOMER",
  "INVOICE",
  "ORGANIZATION",
]);

/** Only http/https URLs may be stored (defense-in-depth alongside the provider). */
const httpUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "Only http(s) URLs are allowed.",
  });

/**
 * Input to attach a file. `entityType`/`entityId` are both optional and must be
 * supplied together (null = an organization-level "company document"), mirroring
 * the polymorphic nullable convention of Task.
 */
export const attachFileSchema = z
  .object({
    entityType: entityTypeEnum.optional(),
    entityId: z.string().uuid().optional(),
    url: httpUrl,
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(255).optional(),
    sizeBytes: z.number().int().nonnegative().optional(),
    category: z.enum(FILE_CATEGORIES),
  })
  .refine(
    (v) => (v.entityType === undefined) === (v.entityId === undefined),
    { message: "entityType and entityId must be provided together." },
  );

export type AttachFileInput = z.infer<typeof attachFileSchema>;
