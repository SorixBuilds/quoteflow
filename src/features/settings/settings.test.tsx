import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompanyProfileForm } from "@/features/settings/components/CompanyProfileForm";
import { NumberingForm } from "@/features/settings/components/NumberingForm";
import { FeatureFlagsDisplay } from "@/features/settings/components/FeatureFlagsDisplay";
import { DEFAULT_COMPANY_CONFIG } from "@/lib/config/defaults";

const okProfile = vi.fn(async () => ({
  success: true as const,
  data: { name: "Acme", logoUrl: "" },
}));

function makeConfigAction() {
  return vi.fn(async () => ({
    success: true as const,
    data: DEFAULT_COMPANY_CONFIG,
  }));
}

const profileInitial = {
  name: "Acme",
  logoUrl: "",
  primaryColor: "#16243B",
  accentColor: "#F2994A",
};

describe("CompanyProfileForm (Step 8)", () => {
  it("disables Save until the form is dirty, then shows the unsaved indicator", () => {
    render(
      <CompanyProfileForm
        initial={profileInitial}
        saveConfig={makeConfigAction()}
        saveProfile={okProfile}
      />,
    );

    const save = screen.getByRole("button", { name: /save changes/i });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/organization name/i), {
      target: { value: "Acme Plumbing" },
    });
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    expect(save).toBeEnabled();
  });

  it("blocks submit and shows an inline error for an invalid hex color", async () => {
    const saveConfig = makeConfigAction();
    render(
      <CompanyProfileForm
        initial={profileInitial}
        saveConfig={saveConfig}
        saveProfile={okProfile}
      />,
    );

    fireEvent.change(screen.getByLabelText(/primary brand color/i), {
      target: { value: "blue" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/hex color/i)).toBeInTheDocument();
    expect(saveConfig).not.toHaveBeenCalled();
  });

  it("submits a valid change through the config action", async () => {
    const saveConfig = makeConfigAction();
    render(
      <CompanyProfileForm
        initial={profileInitial}
        saveConfig={saveConfig}
        saveProfile={okProfile}
      />,
    );

    fireEvent.change(screen.getByLabelText(/accent brand color/i), {
      target: { value: "#000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(saveConfig).toHaveBeenCalledWith({
        branding: { primaryColor: "#16243B", accentColor: "#000000" },
      }),
    );
  });
});

describe("NumberingForm validation (Step 8)", () => {
  it("rejects a padding above the allowed maximum", async () => {
    const saveConfig = makeConfigAction();
    render(
      <NumberingForm
        initial={{
          quotePrefix: "Q",
          invoicePrefix: "INV",
          padding: 4,
          resetPolicy: "never",
          defaultTaxRatePercent: 0,
        }}
        saveConfig={saveConfig}
      />,
    );

    fireEvent.change(screen.getByLabelText(/number padding/i), {
      target: { value: "99" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    // Invalid → action never called. Assert after a microtask flush.
    await Promise.resolve();
    expect(saveConfig).not.toHaveBeenCalled();
  });
});

describe("FeatureFlagsDisplay (Step 8/20)", () => {
  it("renders invoicing enabled and the rest disabled by default", () => {
    render(
      <FeatureFlagsDisplay featureFlags={DEFAULT_COMPANY_CONFIG.featureFlags} />,
    );
    const invoicing = screen.getByText("Invoicing").closest("li")!;
    expect(invoicing).toHaveTextContent("Enabled");
    const ai = screen.getByText("AI features").closest("li")!;
    expect(ai).toHaveTextContent("Disabled");
  });
});
