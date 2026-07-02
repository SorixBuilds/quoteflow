"use client";

import { useState, useTransition } from "react";
import type { EntityType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { FILE_CATEGORIES, type FileCategory } from "@/features/files/validation";
import type { AttachFileInput } from "@/features/files/validation";
import type { ActionResult } from "@/types";

/**
 * Attach-file form (§14.5). Client island inside the server `FileAttachmentList`.
 * Under the zero-cost `UrlPasteProvider` this is the URL-paste widget — the exact
 * pattern `FileUrlInput` already uses for `Organization.logoUrl`. When the funded
 * `VercelBlobProvider` is wired, a `<UploadDropzone>` replaces this input with no
 * change to the `attachFile` action it calls (§14.13).
 */
export function AttachFileForm({
  entityType,
  entityId,
  action,
}: {
  entityType: EntityType;
  entityId: string;
  action: (input: AttachFileInput) => Promise<ActionResult<{ id: string }>>;
}) {
  const [url, setUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState<FileCategory>("DOCUMENT");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = url.trim();
    if (trimmedUrl.length === 0) return;
    // Default the display name to the URL's last path segment when left blank.
    const name = fileName.trim() || lastSegment(trimmedUrl);

    startTransition(async () => {
      const result = await action({
        entityType,
        entityId,
        url: trimmedUrl,
        fileName: name,
        category,
      });
      if (result.success) {
        setUrl("");
        setFileName("");
        setCategory("DOCUMENT");
        showSuccessToast("File attached.");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1">
          <label className="text-muted-foreground mb-1 block text-xs font-medium">
            File URL
          </label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            inputMode="url"
          />
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="text-muted-foreground mb-1 block text-xs font-medium">
            Name (optional)
          </label>
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="Display name"
          />
        </div>
        <div className="w-40">
          <label className="text-muted-foreground mb-1 block text-xs font-medium">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as FileCategory)}
            className={cn(
              "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {FILE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {labelFor(c)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={isPending || url.trim().length === 0}>
          {isPending ? "Attaching…" : "Attach"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Paste a link to an image or document (Drive, Dropbox, a CDN, etc.).
      </p>
    </form>
  );
}

function labelFor(category: FileCategory): string {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

function lastSegment(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segment = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
    return segment || "Attachment";
  } catch {
    return "Attachment";
  }
}
