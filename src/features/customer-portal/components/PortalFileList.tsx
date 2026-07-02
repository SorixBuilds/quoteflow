import { Download, FileText, ImageIcon } from "lucide-react";

import type { AttachmentView } from "@/features/files/queries";

/**
 * Read-only attachment list for the portal (§6 of the Step 4 brief, §14). The
 * portal never uploads, renames, or deletes — it lists files on an entity the
 * caller has already proven the customer owns (`getPortalEntityFiles`) and offers
 * preview/download via the same plain stored-URL link the internal app uses (no
 * server proxy, no SSRF surface, §14.9). Presentational only.
 */
export function PortalFileList({ attachments }: { attachments: AttachmentView[] }) {
  if (attachments.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-foreground text-sm font-semibold">Files</h2>
      <ul className="divide-border border-border divide-y rounded-lg border">
        {attachments.map((file) => (
          <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
            <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded border [&_svg]:size-4">
              {file.isImage ? <ImageIcon /> : <FileText />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">{file.fileName}</p>
              <p className="text-muted-foreground truncate text-xs">
                {formatFileSize(file.sizeBytes)}
                {` · ${file.createdAt.toLocaleDateString()}`}
              </p>
            </div>
            <a
              href={file.url}
              download
              target="_blank"
              rel="noopener noreferrer"
              title="Download"
              className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors [&_svg]:size-4"
            >
              <Download />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Human-readable byte size (binary units); `null` size renders nothing. */
function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "File";
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
