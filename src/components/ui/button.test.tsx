import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its children", () => {
    render(<Button>Build the pipeline</Button>);
    expect(
      screen.getByRole("button", { name: "Build the pipeline" }),
    ).toBeInTheDocument();
  });

  it("applies the amber CTA variant", () => {
    render(<Button variant="cta">Send quote</Button>);
    expect(screen.getByRole("button", { name: "Send quote" })).toHaveClass(
      "bg-brand",
    );
  });
});
