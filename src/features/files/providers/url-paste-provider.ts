import { BusinessRuleError } from "@/lib/errors";
import type {
  StorageProvider,
  StoredFile,
  StoreInput,
} from "@/features/files/providers/types";

/**
 * The zero-cost default storage adapter (Phase 6, §14.1, §14.6).
 *
 * Stores no bytes. It validates a user-pasted `url` (must be a well-formed
 * http/https URL) and returns it as the durable reference — exactly the pattern
 * the frozen `Organization.logoUrl` already uses, generalized to any attachment.
 * A funded `VercelBlobProvider` will accept `data` and upload it, returning a
 * real blob URL through this same `StoredFile` shape, so the consuming workflow
 * never changes (§14.13).
 *
 * Validation lives here (not only in a Zod schema upstream) so the rule holds no
 * matter who calls the provider — defense in depth, the same discipline the
 * Configuration Service uses (§5.5).
 */
export class UrlPasteProvider implements StorageProvider {
  readonly name = "url";

  async store(input: StoreInput): Promise<StoredFile> {
    if (!input.url) {
      throw new BusinessRuleError("A file URL is required.");
    }
    const url = input.url.trim();

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BusinessRuleError("Enter a valid URL, e.g. https://example.com/file.pdf");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      // Reject javascript:, data:, file:, etc. — only fetchable web URLs.
      throw new BusinessRuleError("Only http and https URLs are allowed.");
    }

    return {
      url,
      fileName: input.fileName.trim(),
      mimeType: input.mimeType,
      // URL-paste mode cannot know the byte size without fetching; left
      // undefined, matching FileAttachment.sizeBytes being nullable (§7.2.2).
      sizeBytes: undefined,
    };
  }
}
