import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/permissions", () => ({
  requireSession: vi.fn(),
  requireActiveUser: vi.fn(),
  requireCompanyScope: vi.fn(),
}));
vi.mock("@/features/activity/actions", () => ({ logActivity: vi.fn() }));
vi.mock("@/features/files/access", () => ({ canManageAttachmentTarget: vi.fn() }));
vi.mock("@/features/files/repository", () => ({
  createFileAttachment: vi.fn(),
  getFileAttachmentById: vi.fn(),
  deleteFileAttachment: vi.fn(),
  renameFileAttachment: vi.fn(),
}));

import { requireCompanyScope, requireSession } from "@/lib/permissions";
import { logActivity } from "@/features/activity/actions";
import { canManageAttachmentTarget } from "@/features/files/access";
import {
  createFileAttachment,
  deleteFileAttachment,
  getFileAttachmentById,
  renameFileAttachment,
} from "@/features/files/repository";
import { providerRegistry } from "@/lib/providers/registry";
import type { StorageProvider } from "@/features/files/providers/types";
import { attachFile, removeAttachment, renameAttachment } from "@/features/files/actions";

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const ATT_ID = "22222222-2222-4222-8222-222222222222";
const session = {
  id: "u1",
  organizationId: "org-1",
  role: "OWNER" as const,
  name: "Dana",
  email: "dana@acme.test",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSession).mockResolvedValue(session);
  vi.mocked(requireCompanyScope).mockResolvedValue({ organizationId: "org-1" });
  vi.mocked(canManageAttachmentTarget).mockResolvedValue(true);
  vi.mocked(createFileAttachment).mockResolvedValue({ id: "att-1" } as never);
  vi.mocked(getFileAttachmentById).mockResolvedValue({
    id: ATT_ID,
    entityType: "JOB",
    entityId: JOB_ID,
    fileName: "before.jpg",
  } as never);
  vi.mocked(deleteFileAttachment).mockResolvedValue(true);
  vi.mocked(renameFileAttachment).mockResolvedValue(true);
});

afterEach(() => {
  providerRegistry.reset();
});

describe("attachFile (§14.6)", () => {
  const input = {
    entityType: "JOB" as const,
    entityId: JOB_ID,
    url: "https://cdn.example.com/before.jpg",
    fileName: "before.jpg",
    category: "BEFORE" as const,
  };

  it("stores via the provider, writes the row, and logs Activity", async () => {
    const result = await attachFile(input);
    expect(result).toEqual({ success: true, data: { id: "att-1" } });

    // The URL persisted is the one the provider returned (real UrlPasteProvider).
    expect(createFileAttachment).toHaveBeenCalledWith(
      "org-1",
      "u1",
      expect.objectContaining({ url: input.url, fileName: "before.jpg", category: "BEFORE" }),
    );
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: "JOB", entityId: JOB_ID, type: "file_attached" }),
    );
  });

  it("refuses when the caller cannot manage the target (no row written)", async () => {
    vi.mocked(canManageAttachmentTarget).mockResolvedValue(false);
    const result = await attachFile(input);
    expect(result.success).toBe(false);
    expect(createFileAttachment).not.toHaveBeenCalled();
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("rejects a non-http(s) URL at the boundary (no provider call, no row)", async () => {
    const result = await attachFile({ ...input, url: "javascript:alert(1)" });
    expect(result.success).toBe(false);
    expect(createFileAttachment).not.toHaveBeenCalled();
  });

  it("does not log Activity for an organization-level file", async () => {
    const result = await attachFile({
      url: "https://cdn.example.com/policy.pdf",
      fileName: "policy.pdf",
      category: "DOCUMENT",
    });
    expect(result.success).toBe(true);
    expect(logActivity).not.toHaveBeenCalled();
  });

  it("flows a funded provider's sizeBytes through to the row (DI swap)", async () => {
    const blob: StorageProvider = {
      name: "vercel-blob",
      store: async () => ({
        url: "https://blob.example.com/org/abc/before.jpg",
        fileName: "before.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
      }),
    };
    providerRegistry.override<StorageProvider>("storage", () => blob);

    await attachFile(input);
    expect(createFileAttachment).toHaveBeenCalledWith(
      "org-1",
      "u1",
      expect.objectContaining({ sizeBytes: 2048, url: "https://blob.example.com/org/abc/before.jpg" }),
    );
  });
});

describe("removeAttachment (§14.6, §14.8)", () => {
  it("deletes an in-scope attachment and logs Activity", async () => {
    const result = await removeAttachment(ATT_ID);
    expect(result).toEqual({ success: true, data: null });
    expect(deleteFileAttachment).toHaveBeenCalledWith("org-1", ATT_ID);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "file_removed", entityId: JOB_ID }),
    );
  });

  it("returns not-found for an attachment outside the org (no delete)", async () => {
    vi.mocked(getFileAttachmentById).mockResolvedValue(null);
    const result = await removeAttachment(ATT_ID);
    expect(result.success).toBe(false);
    expect(deleteFileAttachment).not.toHaveBeenCalled();
  });

  it("refuses when the caller cannot manage the parent (no delete)", async () => {
    vi.mocked(canManageAttachmentTarget).mockResolvedValue(false);
    const result = await removeAttachment(ATT_ID);
    expect(result.success).toBe(false);
    expect(deleteFileAttachment).not.toHaveBeenCalled();
  });
});

describe("renameAttachment (§14.6)", () => {
  it("renames an in-scope attachment and logs Activity", async () => {
    const result = await renameAttachment(ATT_ID, "after.jpg");
    expect(result).toEqual({ success: true, data: null });
    expect(renameFileAttachment).toHaveBeenCalledWith("org-1", ATT_ID, "after.jpg");
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ type: "file_renamed", message: "after.jpg" }),
    );
  });

  it("rejects an empty name (validation, no write)", async () => {
    const result = await renameAttachment(ATT_ID, "   ");
    expect(result.success).toBe(false);
    expect(renameFileAttachment).not.toHaveBeenCalled();
  });
});
