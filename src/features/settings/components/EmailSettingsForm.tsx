"use client";

import { useState, useTransition } from "react";

import { showSuccessToast } from "@/components/shared/SuccessToast";
import type { CompanyConfig, CompanyConfigPatch } from "@/lib/config/schema";
import type { ActionResult } from "@/types";
import {
  SaveBar,
  TextField,
  TextareaField,
} from "@/features/settings/components/fields";

type ConfigAction = (
  partial: CompanyConfigPatch,
) => Promise<ActionResult<CompanyConfig>>;

type Initial = {
  senderName: string;
  senderEmail: string;
  replyTo: string;
  footer: string;
  signature: string;
};

/**
 * Email sender-identity settings (Phase 6B Step 5, §9, §13). Edits `config.email`
 * — the from/reply-to/footer/signature the Email Service stamps on every outbound
 * message. These are the *only* source of an email's sender identity (§11.9: a
 * `from` is never client-supplied), so this form is the one place they're set.
 * Blank sender email = fall back to the platform default address.
 */
export function EmailSettingsForm({
  initial,
  saveConfig,
}: {
  initial: Initial;
  saveConfig: ConfigAction;
}) {
  const [baseline, setBaseline] = useState(initial);
  const [senderName, setSenderName] = useState(initial.senderName);
  const [senderEmail, setSenderEmail] = useState(initial.senderEmail);
  const [replyTo, setReplyTo] = useState(initial.replyTo);
  const [footer, setFooter] = useState(initial.footer);
  const [signature, setSignature] = useState(initial.signature);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty =
    senderName !== baseline.senderName ||
    senderEmail !== baseline.senderEmail ||
    replyTo !== baseline.replyTo ||
    footer !== baseline.footer ||
    signature !== baseline.signature;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    startTransition(async () => {
      const result = await saveConfig({
        email: { senderName, senderEmail, replyTo, footer, signature },
      });
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setBaseline({ senderName, senderEmail, replyTo, footer, signature });
      showSuccessToast("Email settings saved");
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <TextField
        id="senderName"
        label="Sender name"
        value={senderName}
        onChange={setSenderName}
        hint="Shown as the email's From name. Defaults to your company name."
      />
      <TextField
        id="senderEmail"
        label="Sender email"
        value={senderEmail}
        onChange={setSenderEmail}
        hint="Must be on a verified domain. Leave blank to use the platform default."
      />
      <TextField
        id="replyTo"
        label="Reply-to email"
        value={replyTo}
        onChange={setReplyTo}
        hint="Optional. Where customer replies should go."
      />
      <TextareaField
        id="signature"
        label="Email signature"
        value={signature}
        onChange={setSignature}
        rows={3}
      />
      <TextareaField
        id="footer"
        label="Email footer"
        value={footer}
        onChange={setFooter}
        rows={2}
      />
      <SaveBar dirty={dirty} isPending={isPending} formError={formError} />
    </form>
  );
}
