import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FileUrlInput } from "@/features/files/components/FileUrlInput";
import { fileUrlSchema, isImageUrl } from "@/features/files/types";

describe("fileUrlSchema (Step 12)", () => {
  it("accepts a valid URL and an empty string, rejects junk", () => {
    expect(fileUrlSchema.safeParse("https://x.com/logo.png").success).toBe(true);
    expect(fileUrlSchema.safeParse("").success).toBe(true);
    expect(fileUrlSchema.safeParse("not a url").success).toBe(false);
  });
});

describe("isImageUrl", () => {
  it("detects common image extensions", () => {
    expect(isImageUrl("https://x.com/a.png")).toBe(true);
    expect(isImageUrl("https://x.com/a.pdf")).toBe(false);
  });
});

describe("FileUrlInput (Step 12)", () => {
  it("renders an image preview only for image URLs", () => {
    const { rerender } = render(
      <FileUrlInput
        id="logoUrl"
        label="Logo URL"
        value="https://x.com/logo.png"
        onChange={() => {}}
      />,
    );
    expect(screen.getByAltText("Logo preview")).toBeInTheDocument();

    rerender(
      <FileUrlInput
        id="logoUrl"
        label="Logo URL"
        value="https://x.com/page"
        onChange={() => {}}
      />,
    );
    expect(screen.queryByAltText("Logo preview")).toBeNull();
  });

  it("propagates typed input", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FileUrlInput id="logoUrl" label="Logo URL" value="" onChange={onChange} />,
    );
    await user.type(screen.getByLabelText("Logo URL"), "h");
    expect(onChange).toHaveBeenCalledWith("h");
  });

  it("shows an inline error", () => {
    render(
      <FileUrlInput
        id="logoUrl"
        label="Logo URL"
        value="bad"
        onChange={() => {}}
        error="Enter a valid URL (https://…)."
      />,
    );
    expect(screen.getByText(/valid URL/i)).toBeInTheDocument();
  });
});
