"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { TextField } from "@/features/settings/components/fields";
import {
  createKey,
  revokeKey,
  rotateKey,
  type CreatedKeyResult,
} from "@/features/api-keys/actions";
import type { ApiScope } from "@/features/api-keys/key";

/**
 * Settings → API Keys (§21.5): create a key with an explicit scope subset,
 * see every key's status/usage, rotate, and revoke. The full key is displayed
 * exactly once after create/rotate — the same "copy this now" pattern the
 * portal link and teammate temporary passwords already use — because only its
 * hash is stored (§21.9).
 *
 * Scope options are a display catalog only, type-checked against the closed
 * `ApiScope` union (type-only import — the crypto module never enters the
 * client bundle). `webhooks:manage` is deliberately not offered: webhooks are
 * managed in Settings → Integrations under the staff session; the scope stays
 * reserved for a future API-managed webhook surface, per §21.14's
 * additive-only policy.
 */

const SCOPE_OPTIONS = [
  { value: "leads:read", label: "Leads — read" },
  { value: "leads:write", label: "Leads — write" },
  { value: "quotes:read", label: "Quotes — read" },
  { value: "quotes:write", label: "Quotes — write" },
  { value: "jobs:read", label: "Jobs — read" },
  { value: "jobs:write", label: "Jobs — write" },
  { value: "invoices:read", label: "Invoices — read" },
  { value: "invoices:write", label: "Invoices — write" },
  { value: "customers:read", label: "Customers — read" },
  { value: "customers:write", label: "Customers — write" },
] as const satisfies readonly { value: ApiScope; label: string }[];

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  /** Pre-formatted display strings (the page formats server-side). */
  createdAt: string;
  lastUsedAt: string | null;
};

function OneTimeKeyPanel({ result }: { result: CreatedKeyResult }) {
  const [copied, setCopied] = useState(false);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(result.plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showErrorToast("Couldn't copy — select the key and copy manually.");
    }
  }

  return (
    <div className="border-border bg-muted/30 space-y-2 rounded-md border border-dashed p-3">
      <p className="text-muted-foreground text-xs">
        API key <span className="text-foreground font-medium">{result.name}</span> — copy it
        now and store it somewhere safe. It won&apos;t be shown again.
      </p>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={result.plaintext}
          className="font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
        <Button type="button" variant="outline" size="sm" onClick={copyKey}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function ApiKeysManager({ keys }: { keys: ApiKeyRow[] }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<ApiScope[]>([]);
  const [newKey, setNewKey] = useState<CreatedKeyResult | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; kind: "revoke" | "rotate" } | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();

  function toggleScope(scope: ApiScope, checked: boolean) {
    setScopes((current) =>
      checked ? [...current, scope] : current.filter((s) => s !== scope),
    );
  }

  function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createKey({ name, scopes });
      if (result.success) {
        setNewKey(result.data);
        setName("");
        setScopes([]);
        showSuccessToast("API key created — copy it now, it won't be shown again.");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  function onRevoke(id: string) {
    setConfirming(null);
    startTransition(async () => {
      const result = await revokeKey(id);
      if (result.success) showSuccessToast("API key revoked.");
      else showErrorToast(result.error);
    });
  }

  function onRotate(id: string) {
    setConfirming(null);
    startTransition(async () => {
      const result = await rotateKey(id);
      if (result.success) {
        setNewKey(result.data);
        showSuccessToast("Key rotated — the old key no longer works. Copy the new one now.");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="space-y-4 rounded-lg border p-4">
        <TextField
          id="api-key-name"
          label="Key name"
          value={name}
          onChange={setName}
          placeholder="e.g. Zapier integration"
          hint="A label that tells you where this key is used."
        />
        <fieldset className="space-y-2">
          <legend className="text-foreground text-sm font-medium">Scopes</legend>
          <p className="text-muted-foreground text-xs">
            Grant only what the integration needs — scopes can&apos;t be edited later; rotate
            the key to change them.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SCOPE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scopes.includes(option.value)}
                  onChange={(e) => toggleScope(option.value, e.target.checked)}
                  className="border-input size-4 rounded"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" disabled={isPending || name.trim() === "" || scopes.length === 0}>
          {isPending ? "Working…" : "Create key"}
        </Button>
      </form>

      {newKey ? <OneTimeKeyPanel result={newKey} /> : null}

      {keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No API keys yet"
          description="Create a key to let an external tool read your QuoteFlow data over the versioned API."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-foreground truncate text-sm font-medium">{key.name}</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      key.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-slate-100 text-slate-700",
                    )}
                  >
                    {key.isActive ? "Active" : "Revoked"}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 font-mono text-xs">{key.keyPrefix}…</p>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {key.scopes.join(", ")} · Created {key.createdAt} ·{" "}
                  {key.lastUsedAt ? `Last used ${key.lastUsedAt}` : "Never used"}
                </p>
              </div>
              {key.isActive ? (
                <div className="flex items-center gap-2">
                  {confirming?.id === key.id ? (
                    <>
                      <Button
                        type="button"
                        variant={confirming.kind === "revoke" ? "destructive" : "default"}
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          confirming.kind === "revoke" ? onRevoke(key.id) : onRotate(key.id)
                        }
                      >
                        Confirm {confirming.kind}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirming(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setConfirming({ id: key.id, kind: "rotate" })}
                      >
                        Rotate
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setConfirming({ id: key.id, kind: "revoke" })}
                      >
                        Revoke
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
