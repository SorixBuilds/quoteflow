"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { SelectField, TextField } from "@/features/settings/components/fields";
import type { LeadInput } from "@/features/leads/schema";
import type { ActionResult } from "@/types";

type Option = { id: string; name: string };

/** Lead create/edit form (Phase 5, §14). */
export function LeadForm({
  initial,
  sources,
  staff,
  showAssignee = true,
  onSubmit,
  onCancel,
  onDone,
  submitLabel,
}: {
  initial?: {
    name: string;
    email: string | null;
    phone: string;
    sourceId: string | null;
    assignedToId?: string | null;
  };
  sources: Option[];
  staff: Option[];
  showAssignee?: boolean;
  onSubmit: (input: LeadInput) => Promise<ActionResult<unknown>>;
  onCancel?: () => void;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [sourceId, setSourceId] = useState(initial?.sourceId ?? "");
  const [assignedToId, setAssignedToId] = useState(initial?.assignedToId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSubmit({ name, email, phone, sourceId, assignedToId });
      if (result.success) {
        showSuccessToast(initial ? "Lead updated" : "Lead created");
        onDone?.();
      } else {
        setError(result.error);
        showErrorToast(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="lead-name" label="Name" value={name} onChange={setName} />
        <TextField id="lead-phone" label="Phone" value={phone} onChange={setPhone} />
        <TextField id="lead-email" label="Email (optional)" value={email} onChange={setEmail} type="email" />
        <SelectField
          id="lead-source"
          label="Source"
          value={sourceId}
          onChange={setSourceId}
          options={[{ value: "", label: "— None —" }, ...sources.map((s) => ({ value: s.id, label: s.name }))]}
        />
        {showAssignee ? (
          <SelectField
            id="lead-assignee"
            label="Assigned to"
            value={assignedToId}
            onChange={setAssignedToId}
            options={[{ value: "", label: "— Unassigned —" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
          />
        ) : null}
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : (submitLabel ?? "Save lead")}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
