import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "@/components/shared/Sidebar";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

const flags = DEFAULT_COMPANY_CONFIG.featureFlags;

describe("Sidebar (Step 6)", () => {
  it("renders the OWNER nav including Settings", () => {
    render(<Sidebar role="OWNER" featureFlags={flags} />);
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reports/i })).toBeInTheDocument();
  });

  it("hides Settings for STAFF but shows Reports & Catalog (§11)", () => {
    render(<Sidebar role="STAFF" featureFlags={flags} />);
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
    expect(screen.getByRole("link", { name: /reports/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /catalog/i })).toBeInTheDocument();
  });

  it("shows only Jobs for FIELD", () => {
    render(<Sidebar role="FIELD" featureFlags={flags} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Jobs");
  });

  it("marks the active route with aria-current", () => {
    render(<Sidebar role="OWNER" featureFlags={flags} />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
