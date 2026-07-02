import { describe, expect, it } from "vitest";

import { UrlPasteProvider } from "@/features/files/providers/url-paste-provider";
import type {
  StorageProvider,
  StoredFile,
  StoreInput,
} from "@/features/files/providers/types";

/**
 * Provider-swap test (§14.12). The whole point of the `StorageProvider` seam is
 * that the zero-cost `UrlPasteProvider` and a funded binary provider are
 * interchangeable with zero change to the consuming workflow. Here a *mock*
 * VercelBlobProvider (a real upload would return a blob URL + known size) is run
 * through the exact same row-building mapping `attachFile` uses, and we assert
 * both yield an identically-shaped `FileAttachment` row.
 */

/** A stand-in funded provider: "uploads" bytes and reports a blob URL + size. */
class MockBlobProvider implements StorageProvider {
  readonly name = "vercel-blob";
  async store(input: StoreInput): Promise<StoredFile> {
    return {
      url: `https://blob.example.com/org/abc/${input.fileName}`,
      fileName: input.fileName,
      mimeType: input.mimeType ?? "application/octet-stream",
      sizeBytes: 2048,
    };
  }
}

/** The same projection `attachFile` applies to turn a StoredFile into row data. */
function toRowData(stored: StoredFile, category: string) {
  return {
    url: stored.url,
    fileName: stored.fileName,
    mimeType: stored.mimeType ?? null,
    sizeBytes: stored.sizeBytes ?? null,
    category,
  };
}

describe("storage provider swap produces identical FileAttachment shapes", () => {
  it("UrlPasteProvider and a mock VercelBlobProvider yield the same row keys", async () => {
    const urlStored = await new UrlPasteProvider().store({
      fileName: "before.jpg",
      url: "https://cdn.example.com/before.jpg",
      mimeType: "image/jpeg",
    });
    const blobStored = await new MockBlobProvider().store({
      fileName: "before.jpg",
      data: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
    });

    const urlRow = toRowData(urlStored, "BEFORE");
    const blobRow = toRowData(blobStored, "BEFORE");

    // Identical column set — the consumer never knows which provider ran.
    expect(Object.keys(urlRow).sort()).toEqual(Object.keys(blobRow).sort());

    // Same field semantics; only the values differ (URL vs. blob URL, size).
    expect(urlRow.fileName).toBe(blobRow.fileName);
    expect(urlRow.category).toBe(blobRow.category);
    expect(typeof urlRow.url).toBe("string");
    expect(typeof blobRow.url).toBe("string");
    // URL-paste cannot know size; the funded provider does. Both are valid rows.
    expect(urlRow.sizeBytes).toBeNull();
    expect(blobRow.sizeBytes).toBe(2048);
  });
});
