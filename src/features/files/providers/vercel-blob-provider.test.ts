import { describe, expect, it } from "vitest";

import {
  ALLOWED_UPLOAD_MIME,
  MAX_UPLOAD_BYTES,
  VercelBlobProvider,
  byteLength,
  isAllowedUploadMime,
  isWithinSizeLimit,
  organizationBlobPrefix,
} from "@/features/files/providers/vercel-blob-provider";
import { ProviderNotConfiguredError } from "@/lib/providers/types";

/**
 * The funded adapter is written, not wired (§14.13). These tests pin the
 * upload-hardening rules (§14.9) that are *designed now, enforced when the
 * provider is activated*, and prove that selecting it without the SDK fails
 * loudly rather than silently storing nothing.
 */

describe("VercelBlobProvider hardening rules (§14.9)", () => {
  it("accepts only the image/pdf allow-list (case-insensitive)", () => {
    for (const mime of ALLOWED_UPLOAD_MIME) {
      expect(isAllowedUploadMime(mime)).toBe(true);
      expect(isAllowedUploadMime(mime.toUpperCase())).toBe(true);
    }
    expect(isAllowedUploadMime("text/html")).toBe(false);
    expect(isAllowedUploadMime("application/x-msdownload")).toBe(false);
    expect(isAllowedUploadMime(undefined)).toBe(false);
  });

  it("enforces the 10 MB size ceiling", () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
    expect(isWithinSizeLimit(0)).toBe(true);
    expect(isWithinSizeLimit(MAX_UPLOAD_BYTES)).toBe(true);
    expect(isWithinSizeLimit(MAX_UPLOAD_BYTES + 1)).toBe(false);
    expect(isWithinSizeLimit(undefined)).toBe(false);
    expect(isWithinSizeLimit(-1)).toBe(false);
  });

  it("scopes blob keys under a per-organization prefix (no cross-tenant collision)", () => {
    expect(organizationBlobPrefix("org-1")).toBe("org/org-1/");
    expect(organizationBlobPrefix("org-2")).not.toBe(organizationBlobPrefix("org-1"));
  });

  it("measures both ArrayBuffer and Uint8Array payloads", () => {
    expect(byteLength(new Uint8Array(8))).toBe(8);
    expect(byteLength(new ArrayBuffer(16))).toBe(16);
  });
});

describe("VercelBlobProvider.store (deferred funding trigger §14.13)", () => {
  const provider = new VercelBlobProvider();
  const tinyPng = new Uint8Array([1, 2, 3]);

  it('identifies as "vercel-blob"', () => {
    expect(provider.name).toBe("vercel-blob");
  });

  it("rejects a payload with no bytes", async () => {
    await expect(provider.store({ fileName: "f", url: "https://x/y" })).rejects.toBeInstanceOf(
      ProviderNotConfiguredError,
    );
  });

  it("rejects a disallowed MIME type before any upload", async () => {
    await expect(
      provider.store({ fileName: "x.html", data: tinyPng, mimeType: "text/html" }),
    ).rejects.toThrow(/unsupported file type/i);
  });

  it("rejects an oversized file before any upload", async () => {
    await expect(
      provider.store({
        fileName: "big.png",
        data: new Uint8Array(MAX_UPLOAD_BYTES + 1),
        mimeType: "image/png",
      }),
    ).rejects.toThrow(/10 MB/i);
  });

  it("surfaces a clear not-configured error for a valid payload (SDK not installed)", async () => {
    await expect(
      provider.store({ fileName: "ok.png", data: tinyPng, mimeType: "image/png" }),
    ).rejects.toThrow(/@vercel\/blob/i);
  });
});
