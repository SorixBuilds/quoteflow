"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Webhook as WebhookIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { TextField } from "@/features/settings/components/fields";
import {
  createWebhookAction,
  removeWebhook,
  toggleWebhook,
  type CreatedWebhookResult,
} from "@/features/webhooks/actions";
import { WEBHOOK_EVENTS } from "@/features/webhooks/events";

/**
 * Outbound webhook management (§21.5) — create a subscription (https URL + an
 * explicit event subset from the closed taxonomy), see recent delivery
 * outcomes, enable/disable, delete. The HMAC signing secret is displayed once
 * after creation — the same "copy this now" pattern as API keys — because it
 * is never re-displayed (§22.2).
 */

export type WebhookRow = {
  id: string;
  url: string;
  subscribedEvents: string[];
  isActive: boolean;
  createdAt: string;
  recentDeliveries: {
    id: string;
    eventType: string;
    status: string;
    responseStatusCode: number | null;
    attempts: number;
    createdAt: string;
  }[];
};

const DELIVERY_BADGE: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  PENDING: "bg-slate-100 text-slate-700",
};

function OneTimeSecretPanel({ result }: { result: CreatedWebhookResult }) {
  const [copied, setCopied] = useState(false);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(result.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showErrorToast("Couldn't copy — select the secret and copy manually.");
    }
  }

  return (
    <div className="border-border bg-muted/30 space-y-2 rounded-md border border-dashed p-3">
      <p className="text-muted-foreground text-xs">
        Signing secret for <span className="text-foreground font-medium">{result.url}</span> —
        copy it now and store it with the receiving endpoint. It won&apos;t be shown again.
        Each delivery carries an <code className="font-mono">X-QuoteFlow-Signature</code> header
        (HMAC-SHA256) your endpoint verifies with this secret.
      </p>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={result.secret}
          className="font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />
        <Button type="button" variant="outline" size="sm" onClick={copySecret}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function WebhooksManager({ webhooks }: { webhooks: WebhookRow[] }) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<CreatedWebhookResult | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleEvent(event: string, checked: boolean) {
    setEvents((current) =>
      checked ? [...current, event] : current.filter((e) => e !== event),
    );
  }

  function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createWebhookAction({ url, subscribedEvents: events });
      if (result.success) {
        setNewSecret(result.data);
        setUrl("");
        setEvents([]);
        showSuccessToast("Webhook created — copy the signing secret now.");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  function onToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      const result = await toggleWebhook(id, isActive);
      if (result.success) {
        showSuccessToast(isActive ? "Webhook enabled." : "Webhook disabled.");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  function onDelete(id: string) {
    setConfirmingDeleteId(null);
    startTransition(async () => {
      const result = await removeWebhook(id);
      if (result.success) showSuccessToast("Webhook deleted.");
      else showErrorToast(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onCreate} className="space-y-4 rounded-lg border p-4">
        <TextField
          id="webhook-url"
          label="Endpoint URL"
          value={url}
          onChange={setUrl}
          placeholder="https://example.com/quoteflow/webhook"
          hint="Must be https. QuoteFlow POSTs a signed JSON payload for each subscribed event."
        />
        <fieldset className="space-y-2">
          <legend className="text-foreground text-sm font-medium">Events</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {WEBHOOK_EVENTS.map((event) => (
              <label key={event} className="flex items-center gap-2 font-mono text-xs">
                <input
                  type="checkbox"
                  checked={events.includes(event)}
                  onChange={(e) => toggleEvent(event, e.target.checked)}
                  className="border-input size-4 rounded"
                />
                {event}
              </label>
            ))}
          </div>
        </fieldset>
        <Button
          type="submit"
          disabled={isPending || url.trim() === "" || events.length === 0}
        >
          {isPending ? "Working…" : "Create webhook"}
        </Button>
      </form>

      {newSecret ? <OneTimeSecretPanel result={newSecret} /> : null}

      {webhooks.length === 0 ? (
        <EmptyState
          icon={WebhookIcon}
          title="No webhooks yet"
          description="Create a webhook to push signed event notifications to an external system whenever something happens in QuoteFlow."
        />
      ) : (
        <ul className="divide-y rounded-lg border">
          {webhooks.map((hook) => (
            <li key={hook.id} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground truncate font-mono text-sm">{hook.url}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        hook.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-700",
                      )}
                    >
                      {hook.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {hook.subscribedEvents.join(", ")} · Created {hook.createdAt}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {confirmingDeleteId === hook.id ? (
                    <>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        onClick={() => onDelete(hook.id)}
                      >
                        Confirm delete
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmingDeleteId(null)}
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
                        onClick={() => onToggle(hook.id, !hook.isActive)}
                      >
                        {hook.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={() => setConfirmingDeleteId(hook.id)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {hook.recentDeliveries.length > 0 ? (
                <ul className="space-y-1">
                  {hook.recentDeliveries.map((delivery) => (
                    <li
                      key={delivery.id}
                      className="text-muted-foreground flex items-center gap-2 text-xs"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 font-medium",
                          DELIVERY_BADGE[delivery.status] ?? DELIVERY_BADGE.PENDING,
                        )}
                      >
                        {delivery.status}
                      </span>
                      <span className="font-mono">{delivery.eventType}</span>
                      {delivery.responseStatusCode !== null ? (
                        <span>HTTP {delivery.responseStatusCode}</span>
                      ) : null}
                      <span>
                        attempt {delivery.attempts} · {delivery.createdAt}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
