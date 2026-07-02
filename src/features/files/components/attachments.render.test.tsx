import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AttachmentListView } from "@/features/files/components/FileAttachmentList";
import { formatFileSize } from "@/features/files/components/AttachmentRow";
import type { AttachmentView } from "@/features/files/queries";

/**
 * Render tests for the presentational view (§14.5). `AttachmentListView` is the
 * pure half of `FileAttachmentList` (the async server half resolves data + the
 * permission gate); it binds the server actions itself, so these only assert
 * grouping, the empty state, and the role-gated manage controls — the same split
 * the Activity/Notes panels use.
 */

function attachment(overrides: Partial<AttachmentView> = {}): AttachmentView {
  return {
    id: "a1",
    fileName: "before.jpg",
    url: "https://cdn.example.com/before.jpg",
    category: "BEFORE",
    mimeType: "image/jpeg",
    sizeBytes: 2048,
    isImage: true,
    uploadedByName: "Sam Field",
    createdAt: new Date("2026-06-28T00:00:00Z"),
    ...overrides,
  };
}

describe("formatFileSize", () => {
  it("renders binary units", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("AttachmentListView (§14.5)", () => {
  it("shows an empty state when there are no files", () => {
    render(<AttachmentListView attachments={[]} canManage />);
    expect(screen.getByText(/no files yet/i)).toBeInTheDocument();
  });

  it("renders attachments grouped by category", () => {
    render(
      <AttachmentListView
        attachments={[
          attachment({ id: "a1", fileName: "before.jpg", category: "BEFORE" }),
          attachment({ id: "a2", fileName: "report.pdf", category: "DOCUMENT", isImage: false }),
        ]}
        canManage
      />,
    );
    expect(screen.getByText("before.jpg")).toBeInTheDocument();
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("BEFORE", { selector: "h4" })).toBeInTheDocument();
    expect(screen.getByText("DOCUMENT", { selector: "h4" })).toBeInTheDocument();
  });

  it("hides manage controls (Rename/Remove) when canManage is false", () => {
    render(<AttachmentListView attachments={[attachment()]} canManage={false} />);
    expect(screen.queryByTitle("Remove")).toBeNull();
    expect(screen.queryByTitle("Rename")).toBeNull();
    // Download stays available to anyone who can see the record.
    expect(screen.getByTitle("Download")).toBeInTheDocument();
  });

  it("shows Rename/Remove controls when canManage is true", () => {
    render(<AttachmentListView attachments={[attachment()]} canManage />);
    expect(screen.getByTitle("Remove")).toBeInTheDocument();
    expect(screen.getByTitle("Rename")).toBeInTheDocument();
  });
});
