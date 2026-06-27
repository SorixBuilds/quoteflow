"use client";

import { useState, useTransition } from "react";

import { showSuccessToast } from "@/components/shared/SuccessToast";
import type { CompanyConfig, CompanyConfigPatch } from "@/lib/config/schema";
import type { ActionResult } from "@/types";
import {
  CheckboxField,
  SaveBar,
  TextField,
  TextareaField,
} from "@/features/settings/components/fields";

type ConfigAction = (
  partial: CompanyConfigPatch,
) => Promise<ActionResult<CompanyConfig>>;

type Initial = {
  headerText: string;
  footerText: string;
  showLogo: boolean;
  quoteSentSubjectTemplate: string;
  quoteSentBodyTemplate: string;
};

/**
 * PDF & Email Branding settings form (Phase 4, §8). Edits PDF presentation
 * (`config.pdf`) and the placeholder email templates (`config.email`). No email
 * is actually sent in V1 — Resend remains deferred — these are placeholders the
 * future delivery adapter will consume.
 */
export function BrandingForm({
  initial,
  saveConfig,
}: {
  initial: Initial;
  saveConfig: ConfigAction;
}) {
  const [baseline, setBaseline] = useState(initial);
  const [headerText, setHeaderText] = useState(initial.headerText);
  const [footerText, setFooterText] = useState(initial.footerText);
  const [showLogo, setShowLogo] = useState(initial.showLogo);
  const [subject, setSubject] = useState(initial.quoteSentSubjectTemplate);
  const [body, setBody] = useState(initial.quoteSentBodyTemplate);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    headerText !== baseline.headerText ||
    footerText !== baseline.footerText ||
    showLogo !== baseline.showLogo ||
    subject !== baseline.quoteSentSubjectTemplate ||
    body !== baseline.quoteSentBodyTemplate;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const result = await saveConfig({
        pdf: { headerText, footerText, showLogo },
        email: {
          quoteSentSubjectTemplate: subject,
          quoteSentBodyTemplate: body,
        },
      });
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setBaseline({
        headerText,
        footerText,
        showLogo,
        quoteSentSubjectTemplate: subject,
        quoteSentBodyTemplate: body,
      });
      showSuccessToast("PDF & email settings saved");
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        id="headerText"
        label="PDF header text"
        value={headerText}
        onChange={setHeaderText}
      />
      <TextField
        id="footerText"
        label="PDF footer text"
        value={footerText}
        onChange={setFooterText}
      />
      <CheckboxField
        id="showLogo"
        label="Show logo on PDF"
        checked={showLogo}
        onChange={setShowLogo}
      />
      <TextField
        id="quoteSentSubjectTemplate"
        label="Quote-sent email subject"
        value={subject}
        onChange={setSubject}
        hint="Supports {{companyName}}. No email is sent in V1."
      />
      <TextareaField
        id="quoteSentBodyTemplate"
        label="Quote-sent email body"
        value={body}
        onChange={setBody}
        rows={4}
      />
      <SaveBar dirty={dirty} isPending={isPending} formError={formError} />
    </form>
  );
}
