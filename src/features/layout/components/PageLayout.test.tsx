import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PageActions,
  PageContent,
  PageHeader,
  PageLayout,
  PageSection,
} from "@/features/layout/components/PageLayout";

describe("Page layout primitives (Step 7)", () => {
  it("renders a title and a section heading", () => {
    render(
      <PageLayout>
        <PageHeader title="Settings" breadcrumb={["Settings"]} />
        <PageContent>
          <PageSection title="Company Profile">
            <p>fields</p>
          </PageSection>
        </PageContent>
      </PageLayout>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Company Profile" }),
    ).toBeInTheDocument();
  });

  it("renders breadcrumb trail when provided", () => {
    render(<PageHeader title="Team" breadcrumb={["Settings", "Team"]} />);
    expect(screen.getByLabelText("Breadcrumb")).toBeInTheDocument();
  });

  it("renders PageActions when given, and omits them otherwise", () => {
    const { rerender } = render(
      <PageHeader title="Leads">
        <PageActions>
          <button>New Lead</button>
        </PageActions>
      </PageHeader>,
    );
    expect(
      screen.getByRole("button", { name: "New Lead" }),
    ).toBeInTheDocument();

    rerender(<PageHeader title="Leads" />);
    expect(screen.queryByRole("button", { name: "New Lead" })).toBeNull();
  });
});
