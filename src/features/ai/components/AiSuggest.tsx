"use client";

import { useState, useTransition } from "react";
import { Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { showErrorToast } from "@/components/shared/SuccessToast";
import type { ActionResult } from "@/types";

/**
 * The AI affordance pair (§16.5): `AiSuggestButton` — a small, dismissible
 * control next to a text field — and `AiDraftPanel` — the returned suggestion
 * with explicit Accept/Discard. Composed here as one component since the panel
 * only ever exists under its button.
 *
 * When `enabled` is false this renders NOTHING and can make no network call
 * (§16.10 — not rendered-then-disabled; the flag arrives from the server page
 * via the already-cached company config). Accept hands the text to the parent
 * field's own state; the existing save action persists it — never auto-applied,
 * never written by the AI layer itself (§16.6).
 */
export function AiSuggest({
  enabled,
  label,
  request,
  onAccept,
}: {
  /** The org's `ai` feature flag, resolved server-side at page load. */
  enabled: boolean;
  /** Button caption, e.g. "Suggest notes with AI". */
  label: string;
  /** The flag-gated server action producing the suggestion. */
  request: () => Promise<ActionResult<string>>;
  /** Receives the accepted text; the parent field owns what to do with it. */
  onAccept: (text: string) => void;
}) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!enabled || dismissed) return null;

  function onRequest() {
    startTransition(async () => {
      const result = await request();
      if (result.success) setSuggestion(result.data);
      else showErrorToast(result.error);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={onRequest}
        >
          <Sparkles />
          {isPending ? "Thinking…" : label}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Dismiss AI suggestions"
          onClick={() => setDismissed(true)}
        >
          <X />
        </Button>
      </div>

      {suggestion !== null ? (
        <div className="border-border bg-muted/30 space-y-2 rounded-md border border-dashed p-3">
          <p className="text-foreground text-sm whitespace-pre-wrap">{suggestion}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onAccept(suggestion);
                setSuggestion(null);
              }}
            >
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSuggestion(null)}
            >
              Discard
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
