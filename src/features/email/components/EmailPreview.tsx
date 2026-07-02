"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { showErrorToast } from "@/components/shared/SuccessToast";
import { previewEmailTemplate } from "@/features/email/actions";
import { EMAIL_TEMPLATES, type EmailTemplateInput } from "@/features/email/templates";
import { emailTemplateLabel } from "@/features/email/labels";

/**
 * Read-only email preview (§13). Renders a chosen template through the *real*
 * pipeline (`previewEmailTemplate` → `renderTemplate`) with representative sample
 * data, so an owner sees exactly how their branding/sender settings look. The
 * HTML is shown inside a sandboxed iframe (no scripts, no same-origin) — the
 * preview can never execute or reach app state.
 */

const SAMPLES: { value: string; input: EmailTemplateInput }[] = [
  {
    value: EMAIL_TEMPLATES.quoteShared,
    input: {
      type: EMAIL_TEMPLATES.quoteShared,
      data: {
        customerName: "Jordan Rivera",
        quoteNumber: "Q-1042",
        total: "$2,450.00",
        expiryLabel: "Jul 31, 2026",
        viewUrl: null,
      },
    },
  },
  {
    value: EMAIL_TEMPLATES.invoiceIssued,
    input: {
      type: EMAIL_TEMPLATES.invoiceIssued,
      data: {
        customerName: "Jordan Rivera",
        invoiceNumber: "INV-0310",
        total: "$2,450.00",
        balance: "$2,450.00",
        dueLabel: "Aug 14, 2026",
        viewUrl: null,
      },
    },
  },
  {
    value: EMAIL_TEMPLATES.portalInvitation,
    input: {
      type: EMAIL_TEMPLATES.portalInvitation,
      data: {
        customerName: "Jordan Rivera",
        portalUrl: "https://example.com/portal/login?token=sample",
        expiresLabel: "Sep 27, 2026",
      },
    },
  },
];

export function EmailPreview() {
  const [selected, setSelected] = useState(SAMPLES[0].value);
  const [html, setHtml] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function load(value: string) {
    const sample = SAMPLES.find((s) => s.value === value) ?? SAMPLES[0];
    startTransition(async () => {
      const result = await previewEmailTemplate(sample.input);
      if (result.success) {
        setHtml(result.data.html);
      } else {
        showErrorToast(result.error);
      }
    });
  }

  useEffect(() => {
    load(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((s) => (
          <Button
            key={s.value}
            type="button"
            size="sm"
            variant={s.value === selected ? "default" : "outline"}
            onClick={() => {
              setSelected(s.value);
              load(s.value);
            }}
          >
            {emailTemplateLabel(s.value)}
          </Button>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={isPending ? "<p style='font-family:sans-serif;padding:24px;color:#6B7280'>Loading…</p>" : html}
          className="h-[520px] w-full bg-white"
        />
      </div>
    </div>
  );
}
