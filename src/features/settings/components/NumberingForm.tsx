"use client";

import { useState, useTransition } from "react";

import { showSuccessToast } from "@/components/shared/SuccessToast";
import { NumberingSchema, TaxationSchema } from "@/lib/config/schema";
import type { CompanyConfig, CompanyConfigPatch } from "@/lib/config/schema";
import type { ActionResult } from "@/types";
import {
  SaveBar,
  SelectField,
  TextField,
} from "@/features/settings/components/fields";

type ConfigAction = (
  partial: CompanyConfigPatch,
) => Promise<ActionResult<CompanyConfig>>;

type Initial = {
  quotePrefix: string;
  invoicePrefix: string;
  padding: number;
  resetPolicy: "never" | "yearly";
  defaultTaxRatePercent: number;
};

/**
 * Numbering & Tax settings form (Phase 4, §8). Edits the numbering *format*
 * (`config.numbering`) and default tax rate (`config.taxation`). The numbering
 * *counters* live in dedicated columns (§29) and are never edited here.
 */
export function NumberingForm({
  initial,
  saveConfig,
}: {
  initial: Initial;
  saveConfig: ConfigAction;
}) {
  const [baseline, setBaseline] = useState(initial);
  const [quotePrefix, setQuotePrefix] = useState(initial.quotePrefix);
  const [invoicePrefix, setInvoicePrefix] = useState(initial.invoicePrefix);
  const [padding, setPadding] = useState(String(initial.padding));
  const [resetPolicy, setResetPolicy] = useState<string>(initial.resetPolicy);
  const [taxRate, setTaxRate] = useState(String(initial.defaultTaxRatePercent));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    quotePrefix !== baseline.quotePrefix ||
    invoicePrefix !== baseline.invoicePrefix ||
    padding !== String(baseline.padding) ||
    resetPolicy !== baseline.resetPolicy ||
    taxRate !== String(baseline.defaultTaxRatePercent);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const fieldErrors: Record<string, string> = {};
    const numbering = NumberingSchema.safeParse({
      quotePrefix,
      invoicePrefix,
      padding: Number(padding),
      resetPolicy,
    });
    if (!numbering.success) {
      for (const issue of numbering.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
    }
    const taxation = TaxationSchema.safeParse({
      defaultTaxRatePercent: Number(taxRate),
    });
    if (!taxation.success) {
      fieldErrors.taxRate =
        taxation.error.issues[0]?.message ?? "Enter a value between 0 and 100.";
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const result = await saveConfig({
        numbering: numbering.success ? numbering.data : undefined,
        taxation: taxation.success ? taxation.data : undefined,
      });
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setBaseline({
        quotePrefix,
        invoicePrefix,
        padding: Number(padding),
        resetPolicy: resetPolicy as Initial["resetPolicy"],
        defaultTaxRatePercent: Number(taxRate),
      });
      showSuccessToast("Numbering & tax settings saved");
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="quotePrefix"
          label="Quote number prefix"
          value={quotePrefix}
          onChange={setQuotePrefix}
          error={errors.quotePrefix}
          hint="e.g. Q → Q-0001"
        />
        <TextField
          id="invoicePrefix"
          label="Invoice number prefix"
          value={invoicePrefix}
          onChange={setInvoicePrefix}
          error={errors.invoicePrefix}
          hint="e.g. INV → INV-0001"
        />
        <TextField
          id="padding"
          label="Number padding"
          type="number"
          value={padding}
          onChange={setPadding}
          error={errors.padding}
          hint="Digits to zero-pad the sequence to (0–10)."
        />
        <SelectField
          id="resetPolicy"
          label="Reset policy"
          value={resetPolicy}
          onChange={setResetPolicy}
          options={[
            { value: "never", label: "Never" },
            { value: "yearly", label: "Yearly (manual reset)" },
          ]}
        />
        <TextField
          id="taxRate"
          label="Default tax rate (%)"
          type="number"
          value={taxRate}
          onChange={setTaxRate}
          error={errors.taxRate}
          hint="Applied as the default on new quote lines (0–100)."
        />
      </div>
      <SaveBar dirty={dirty} isPending={isPending} formError={formError} />
    </form>
  );
}
