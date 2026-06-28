"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import type { StatusVariant } from "@/components/shared/StatusBadge";
import type { ActionResult } from "@/types";

/**
 * Status transition control (Phase 5, §13, §22). Renders one button per *legal*
 * next status (the caller computes them from the shared transition maps, so an
 * illegal transition is never offered) and calls the matching server action.
 *
 * Some transitions require a free-text reason captured at the moment of
 * transition — Lead → LOST (`lostReason`, §14) and Job → CANCELLED (a
 * confirmation note, §22). Those reveal an inline required textarea before the
 * action fires; the value is passed to `onTransition` as the second argument.
 */

export type TransitionOption = {
  value: string;
  label: string;
  /** When set, the user must enter a reason before this transition runs. */
  requiresNote?: boolean;
  notePrompt?: string;
  variant?: "default" | "destructive" | "outline";
};

export function StatusTransitionMenu({
  options,
  onTransition,
}: {
  variant?: StatusVariant;
  options: TransitionOption[];
  onTransition: (target: string, note?: string) => Promise<ActionResult<unknown>>;
}) {
  const [pendingNoteFor, setPendingNoteFor] = useState<TransitionOption | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(target: string, noteValue?: string) {
    setError(null);
    startTransition(async () => {
      const result = await onTransition(target, noteValue);
      if (result.success) {
        showSuccessToast("Status updated");
        setPendingNoteFor(null);
        setNote("");
      } else {
        setError(result.error);
        showErrorToast(result.error);
      }
    });
  }

  function handleClick(option: TransitionOption) {
    if (option.requiresNote) {
      setPendingNoteFor(option);
      setNote("");
      setError(null);
    } else {
      run(option.value);
    }
  }

  if (options.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={option.variant ?? "default"}
            disabled={isPending}
            onClick={() => handleClick(option)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {pendingNoteFor ? (
        <div className="space-y-2 rounded-md border p-3">
          <label htmlFor="transition-note" className="text-sm font-medium">
            {pendingNoteFor.notePrompt ?? "Reason"}
          </label>
          <textarea
            id="transition-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
          />
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || note.trim().length === 0}
              onClick={() => run(pendingNoteFor.value, note.trim())}
            >
              {isPending ? "Saving…" : "Confirm"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setPendingNoteFor(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : null}
    </div>
  );
}
