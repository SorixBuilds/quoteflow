"use client";

import { useState, useTransition } from "react";

import { showSuccessToast } from "@/components/shared/SuccessToast";
import { BrandingSchema } from "@/lib/config/schema";
import type { CompanyConfig, CompanyConfigPatch } from "@/lib/config/schema";
import type { ActionResult } from "@/types";
import { FileUrlInput } from "@/features/files/components/FileUrlInput";
import { fileUrlSchema } from "@/features/files/types";
import { SaveBar, TextField } from "@/features/settings/components/fields";

type ConfigAction = (
  partial: CompanyConfigPatch,
) => Promise<ActionResult<CompanyConfig>>;
type ProfileAction = (input: {
  name: string;
  logoUrl: string;
}) => Promise<ActionResult<{ name: string; logoUrl: string }>>;

type Initial = {
  name: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
};

/**
 * Company Profile settings form (Phase 4, §8, §16). Edits the organization name
 * and logo URL (Phase 2 columns, via the FileRef url-paste input) and brand
 * colors (`config.branding`). Config writes route through the Configuration
 * Service action; profile columns through the profile action.
 */
export function CompanyProfileForm({
  initial,
  saveConfig,
  saveProfile,
}: {
  initial: Initial;
  saveConfig: ConfigAction;
  saveProfile: ProfileAction;
}) {
  const [baseline, setBaseline] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [accentColor, setAccentColor] = useState(initial.accentColor);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    name !== baseline.name ||
    logoUrl !== baseline.logoUrl ||
    primaryColor !== baseline.primaryColor ||
    accentColor !== baseline.accentColor;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const fieldErrors: Record<string, string> = {};
    if (name.trim().length === 0) fieldErrors.name = "Required.";
    const logo = fileUrlSchema.safeParse(logoUrl);
    if (!logo.success) {
      fieldErrors.logoUrl = logo.error.issues[0]?.message ?? "Invalid URL.";
    }
    const branding = BrandingSchema.safeParse({ primaryColor, accentColor });
    if (!branding.success) {
      for (const issue of branding.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      if (name !== baseline.name || logoUrl !== baseline.logoUrl) {
        const profileResult = await saveProfile({ name, logoUrl });
        if (!profileResult.success) {
          setFormError(profileResult.error);
          return;
        }
      }
      const result = await saveConfig({ branding: { primaryColor, accentColor } });
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setBaseline({ name, logoUrl, primaryColor, accentColor });
      showSuccessToast("Company profile saved");
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        id="name"
        label="Organization name"
        value={name}
        onChange={setName}
        error={errors.name}
      />
      <FileUrlInput
        id="logoUrl"
        label="Logo URL"
        value={logoUrl}
        onChange={setLogoUrl}
        error={errors.logoUrl}
        hint="Paste a link to your logo image. Leave blank for none."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="primaryColor"
          label="Primary brand color"
          value={primaryColor}
          onChange={setPrimaryColor}
          error={errors.primaryColor}
          hint="Hex, e.g. #16243B. Themes the customer-facing PDF/portal only."
        />
        <TextField
          id="accentColor"
          label="Accent brand color"
          value={accentColor}
          onChange={setAccentColor}
          error={errors.accentColor}
          hint="Hex, e.g. #F2994A."
        />
      </div>
      <SaveBar dirty={dirty} isPending={isPending} formError={formError} />
    </form>
  );
}
