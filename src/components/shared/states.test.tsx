import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";

describe("Shared UI states (Step 9)", () => {
  it("EmptyState renders title, description, and an action", () => {
    render(
      <EmptyState
        title="No leads yet"
        description="Capture your first lead to get started."
        action={<button>New Lead</button>}
      />,
    );
    expect(screen.getByText("No leads yet")).toBeInTheDocument();
    expect(
      screen.getByText("Capture your first lead to get started."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Lead" })).toBeInTheDocument();
  });

  it("ErrorState announces itself via role=alert", () => {
    render(<ErrorState />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("LoadingSkeleton exposes a busy status with the requested line count", () => {
    render(<LoadingSkeleton lines={5} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByTestId("skeleton")).toHaveLength(5);
  });
});
