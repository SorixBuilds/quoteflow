"use client";

import { useState, useTransition } from "react";

import { showSuccessToast } from "@/components/shared/SuccessToast";
import { LocaleSchema } from "@/lib/config/schema";
import type { CompanyConfig, CompanyConfigPatch } from "@/lib/config/schema";
import type { ActionResult } from "@/types";
import { SaveBar, TextField } from "@/features/settings/components/fields";

type ConfigAction = (
  partial: CompanyConfigPatch,
) => Promise<ActionResult<CompanyConfig>>;

type Initial = { timezone: string; currency: string; dateFormat: string };

/**
 * Business Hours & Locale settings form (Phase 4, §8). Edits the business
 * timezone (`config.businessHours`) and currency/date format (`config.locale`).
 * The optional per-day schedule is part of the config shape but not surfaced as
 * a UI control in Phase 4 (no business screen consumes it yet).
 */
export function LocaleForm({
  initial,
  saveConfig,
}: {
  initial: Initial;
  saveConfig: ConfigAction;
}) {
  const [baseline, setBaseline] = useState(initial);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [currency, setCurrency] = useState(initial.currency);
  const [dateFormat, setDateFormat] = useState(initial.dateFormat);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    timezone !== baseline.timezone ||
    currency !== baseline.currency ||
    dateFormat !== baseline.dateFormat;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const fieldErrors: Record<string, string> = {};
    if (timezone.trim().length === 0) fieldErrors.timezone = "Required.";
    const locale = LocaleSchema.safeParse({ currency, dateFormat });
    if (!locale.success) {
      for (const issue of locale.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await saveConfig({
        businessHours: { timezone },
        locale: { currency, dateFormat },
      });
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setBaseline({ timezone, currency, dateFormat });
      showSuccessToast("Locale settings saved");
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        id="timezone"
        label="Business timezone"
        value={timezone}
        onChange={setTimezone}
        error={errors.timezone}
        hint="IANA name, e.g. America/New_York."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="currency"
          label="Currency"
          value={currency}
          onChange={(v) => setCurrency(v.toUpperCase())}
          error={errors.currency}
          hint="3-letter ISO 4217 code, e.g. USD."
        />
        <TextField
          id="dateFormat"
          label="Date format"
          value={dateFormat}
          onChange={setDateFormat}
          error={errors.dateFormat}
          hint="e.g. MM/DD/YYYY."
        />
      </div>
      <SaveBar dirty={dirty} isPending={isPending} formError={formError} />
    </form>
  );
}
