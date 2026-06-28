"use client";

import { useState, useTransition } from "react";
import { Pencil, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { EmptyState } from "@/components/shared/EmptyState";
import { CheckboxField, TextField } from "@/features/settings/components/fields";
import type { TaxRateRow } from "@/features/catalog/queries";
import type { TaxRateInput } from "@/features/catalog/schema";
import type { ActionResult } from "@/types";

type CreateAction = (input: TaxRateInput) => Promise<ActionResult<{ id: string }>>;
type UpdateAction = (id: string, input: TaxRateInput) => Promise<ActionResult<null>>;
type DefaultAction = (id: string) => Promise<ActionResult<null>>;

/** Tax rate CRUD manager (Phase 5, §19). Exactly one default per org. */
export function TaxRateManager({
  rows,
  canWrite,
  createAction,
  updateAction,
  setDefaultAction,
}: {
  rows: TaxRateRow[];
  canWrite: boolean;
  createAction: CreateAction;
  updateAction: UpdateAction;
  setDefaultAction: DefaultAction;
}) {
  const [editing, setEditing] = useState<TaxRateRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => { setCreating(true); setEditing(null); }}>
            New tax rate
          </Button>
        </div>
      ) : null}

      {creating ? (
        <TaxRateForm onCancel={() => setCreating(false)} onSubmit={(i) => createAction(i)} onDone={() => setCreating(false)} />
      ) : null}

      {rows.length === 0 && !creating ? (
        <EmptyState title="No tax rates yet" description="Add the tax rates you apply to quotes." />
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((row) =>
            editing?.id === row.id ? (
              <li key={row.id} className="p-3">
                <TaxRateForm initial={row} onCancel={() => setEditing(null)} onSubmit={(i) => updateAction(row.id, i)} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={row.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{row.name}</p>
                  <span className="text-muted-foreground text-sm">{row.rate}%</span>
                  {row.isDefault ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      <Star className="size-3" /> Default
                    </span>
                  ) : null}
                </div>
                {canWrite ? (
                  <div className="flex items-center gap-2">
                    {!row.isDefault ? <SetDefaultButton id={row.id} action={setDefaultAction} /> : null}
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(row); setCreating(false); }}>
                      <Pencil className="size-4" /> Edit
                    </Button>
                  </div>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function SetDefaultButton({ id, action }: { id: string; action: DefaultAction }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await action(id);
          if (result.success) showSuccessToast("Default tax rate updated");
          else showErrorToast(result.error);
        })
      }
    >
      Set default
    </Button>
  );
}

function TaxRateForm({
  initial,
  onSubmit,
  onCancel,
  onDone,
}: {
  initial?: TaxRateRow;
  onSubmit: (input: TaxRateInput) => Promise<ActionResult<unknown>>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [rate, setRate] = useState(initial?.rate ?? "");
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onSubmit({ name, rate, isDefault });
      if (result.success) {
        showSuccessToast(initial ? "Tax rate updated" : "Tax rate created");
        onDone();
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="tax-name" label="Name" value={name} onChange={setName} />
        <TextField id="tax-rate" label="Rate (%)" value={rate} onChange={setRate} hint="e.g. 8.25" />
      </div>
      <CheckboxField id="tax-default" label="Set as the organization default" checked={isDefault} onChange={setIsDefault} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
