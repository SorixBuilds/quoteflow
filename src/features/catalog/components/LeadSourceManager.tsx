"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { EmptyState } from "@/components/shared/EmptyState";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { TextField } from "@/features/settings/components/fields";
import type { LeadSourceRow } from "@/features/catalog/queries";
import type { LeadSourceInput } from "@/features/catalog/schema";
import type { ActionResult } from "@/types";

type CreateAction = (input: LeadSourceInput) => Promise<ActionResult<{ id: string }>>;
type UpdateAction = (id: string, input: LeadSourceInput) => Promise<ActionResult<null>>;
type ActiveAction = (id: string, isActive: boolean) => Promise<ActionResult<null>>;

/** Lead source CRUD manager (Phase 5, §19). OWNER-write, STAFF read-only. */
export function LeadSourceManager({
  rows,
  currency,
  canWrite,
  createAction,
  updateAction,
  setActiveAction,
}: {
  rows: LeadSourceRow[];
  currency: string;
  canWrite: boolean;
  createAction: CreateAction;
  updateAction: UpdateAction;
  setActiveAction: ActiveAction;
}) {
  const [editing, setEditing] = useState<LeadSourceRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => { setCreating(true); setEditing(null); }}>
            New lead source
          </Button>
        </div>
      ) : null}

      {creating ? (
        <LeadSourceForm onCancel={() => setCreating(false)} onSubmit={(i) => createAction(i)} onDone={() => setCreating(false)} />
      ) : null}

      {rows.length === 0 && !creating ? (
        <EmptyState title="No lead sources yet" description="Track where your leads come from." />
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((row) =>
            editing?.id === row.id ? (
              <li key={row.id} className="p-3">
                <LeadSourceForm initial={row} onCancel={() => setEditing(null)} onSubmit={(i) => updateAction(row.id, i)} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={row.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {row.name}
                    {!row.isActive ? <span className="text-muted-foreground ml-2 text-xs">(inactive)</span> : null}
                  </p>
                  {row.costPerLead ? (
                    <p className="text-muted-foreground text-xs">
                      Cost/lead: <MoneyDisplay value={row.costPerLead} currency={currency} />
                    </p>
                  ) : null}
                </div>
                {canWrite ? (
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(row); setCreating(false); }}>
                      <Pencil className="size-4" /> Edit
                    </Button>
                    <ActiveToggle id={row.id} isActive={row.isActive} action={setActiveAction} />
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

function ActiveToggle({ id, isActive, action }: { id: string; isActive: boolean; action: ActiveAction }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await action(id, !isActive);
          if (!result.success) showErrorToast(result.error);
        })
      }
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </Button>
  );
}

function LeadSourceForm({
  initial,
  onSubmit,
  onCancel,
  onDone,
}: {
  initial?: LeadSourceRow;
  onSubmit: (input: LeadSourceInput) => Promise<ActionResult<unknown>>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [costPerLead, setCostPerLead] = useState(initial?.costPerLead ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onSubmit({ name, costPerLead, isActive });
      if (result.success) {
        showSuccessToast(initial ? "Lead source updated" : "Lead source created");
        onDone();
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="ls-name" label="Name" value={name} onChange={setName} />
        <TextField id="ls-cost" label="Cost per lead (optional)" value={costPerLead} onChange={setCostPerLead} hint="e.g. 25.00" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 rounded" />
        Active
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
