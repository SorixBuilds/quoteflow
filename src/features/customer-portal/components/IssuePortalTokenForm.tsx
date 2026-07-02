"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { issuePortalToken } from "@/features/customer-portal/staff-actions";

/**
 * Staff control to mint a one-time portal link for a customer (§12.6, §12.7).
 * The link is shown ONCE after issuance — the plaintext is never stored and can't
 * be recovered — so the staff member copies it and sends it out-of-band. Reuses
 * the shared design primitives; no new UI affordance.
 */
export function IssuePortalTokenForm({ customerId }: { customerId: string }) {
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLink(null);
    startTransition(async () => {
      const result = await issuePortalToken({
        customerId,
        label,
        expiresInDays: Number(expiresInDays),
      });
      if (result.success) {
        setLink(result.data.url);
        setLabel("");
        showSuccessToast("Portal link created — copy it now, it won't be shown again.");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showErrorToast("Couldn't copy — select the link and copy manually.");
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
        <label className="min-w-40 flex-1 space-y-1.5">
          <span className="text-foreground text-sm font-medium">Label (optional)</span>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Sent via text"
          />
        </label>
        <label className="w-28 space-y-1.5">
          <span className="text-foreground text-sm font-medium">Expires (days)</span>
          <Input
            type="number"
            min={1}
            max={365}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create link"}
        </Button>
      </form>

      {link ? (
        <div className="border-border bg-muted/30 space-y-2 rounded-md border border-dashed p-3">
          <p className="text-muted-foreground text-xs">
            Copy this link and send it to the customer. It won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button type="button" variant="outline" size="sm" onClick={copyLink}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
