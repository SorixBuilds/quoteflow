"use client";

import { useState, useTransition } from "react";
import { Download, FileText, ImageIcon, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { showErrorToast } from "@/components/shared/SuccessToast";
import type { AttachmentView } from "@/features/files/queries";
import type { ActionResult } from "@/types";

/**
 * One attachment row (§14.5). Renders a thumbnail for images and a file icon
 * otherwise, plus metadata (size, uploader, date). Download/preview are plain
 * links to the stored URL — exactly how `Organization.logoUrl` is rendered, no
 * server proxy (§14.9, no SSRF surface). Rename/remove appear only when
 * `canManage` is true; both call their server action and surface failures as a
 * toast, the standard `ActionResult` discipline.
 */
export function AttachmentRow({
  attachment,
  canManage,
  onRename,
  onRemove,
}: {
  attachment: AttachmentView;
  canManage: boolean;
  onRename: (id: string, fileName: string) => Promise<ActionResult<null>>;
  onRemove: (id: string) => Promise<ActionResult<null>>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(attachment.fileName);
  const [isPending, startTransition] = useTransition();

  function submitRename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = name.trim();
    if (next.length === 0 || next === attachment.fileName) {
      setIsEditing(false);
      setName(attachment.fileName);
      return;
    }
    startTransition(async () => {
      const result = await onRename(attachment.id, next);
      if (result.success) {
        setIsEditing(false);
      } else {
        showErrorToast(result.error);
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await onRemove(attachment.id);
      if (!result.success) showErrorToast(result.error);
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Thumbnail attachment={attachment} />

      <div className="min-w-0 flex-1">
        {isEditing ? (
          <form onSubmit={submitRename} className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="h-8"
            />
            <Button type="submit" size="sm" disabled={isPending}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsEditing(false);
                setName(attachment.fileName);
              }}
            >
              <X />
            </Button>
          </form>
        ) : (
          <>
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-primary block truncate text-sm font-medium"
            >
              {attachment.fileName}
            </a>
            <p className="text-muted-foreground truncate text-xs">
              <span className="uppercase">{attachment.category}</span>
              {attachment.sizeBytes != null ? ` · ${formatFileSize(attachment.sizeBytes)}` : ""}
              {` · ${attachment.uploadedByName}`}
              {` · ${attachment.createdAt.toLocaleDateString()}`}
            </p>
          </>
        )}
      </div>

      {!isEditing ? (
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={attachment.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            title="Download"
            className={cn(
              "text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors [&_svg]:size-4",
            )}
          >
            <Download />
          </a>
          {canManage ? (
            <>
              <button
                type="button"
                title="Rename"
                onClick={() => setIsEditing(true)}
                disabled={isPending}
                className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-50 [&_svg]:size-4"
              >
                <Pencil />
              </button>
              <button
                type="button"
                title="Remove"
                onClick={handleRemove}
                disabled={isPending}
                className="text-muted-foreground hover:text-destructive inline-flex size-8 items-center justify-center rounded-md transition-colors disabled:opacity-50 [&_svg]:size-4"
              >
                <Trash2 />
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Thumbnail({ attachment }: { attachment: AttachmentView }) {
  if (attachment.isImage) {
    return (
      // A pasted external URL, rendered exactly like Organization.logoUrl — there
      // is no known image host to configure for next/image, so a plain <img> is
      // correct here (no SSRF surface, no server proxy; §14.9).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={attachment.url}
        alt={attachment.fileName}
        className="size-10 shrink-0 rounded border object-cover"
      />
    );
  }
  return (
    <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded border [&_svg]:size-5">
      {attachment.category === "PHOTO" ? <ImageIcon /> : <FileText />}
    </span>
  );
}

/** Human-readable byte size (binary units), e.g. 1536 → "1.5 KB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
