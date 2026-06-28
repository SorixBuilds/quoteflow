"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { EmptyState } from "@/components/shared/EmptyState";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { SelectField, TextField, TextareaField } from "@/features/settings/components/fields";
import { UNIT_TYPES, type ServiceInput } from "@/features/catalog/schema";
import type { ServiceRow } from "@/features/catalog/queries";
import type { ActionResult } from "@/types";

type CreateAction = (input: ServiceInput) => Promise<ActionResult<{ id: string }>>;
type UpdateAction = (id: string, input: ServiceInput) => Promise<ActionResult<null>>;
type ActiveAction = (id: string, isActive: boolean) => Promise<ActionResult<null>>;

/** Service catalog CRUD manager (Phase 5, §19). OWNER-write, STAFF read-only. */
export function ServiceManager({
  rows,
  categories,
  currency,
  canWrite,
  createAction,
  updateAction,
  setActiveAction,
}: {
  rows: ServiceRow[];
  categories: { id: string; name: string }[];
  currency: string;
  canWrite: boolean;
  createAction: CreateAction;
  updateAction: UpdateAction;
  setActiveAction: ActiveAction;
}) {
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={() => { setCreating(true); setEditing(null); }}>
            New service
          </Button>
        </div>
      ) : null}

      {creating ? (
        <ServiceForm
          categories={categories}
          onCancel={() => setCreating(false)}
          onSubmit={(input) => createAction(input)}
          onDone={() => setCreating(false)}
        />
      ) : null}

      {rows.length === 0 && !creating ? (
        <EmptyState title="No services yet" description="Add the services you quote for." />
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((row) =>
            editing?.id === row.id ? (
              <li key={row.id} className="p-3">
                <ServiceForm
                  initial={row}
                  categories={categories}
                  onCancel={() => setEditing(null)}
                  onSubmit={(input) => updateAction(row.id, input)}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {row.name}
                    {!row.isActive ? (
                      <span className="text-muted-foreground ml-2 text-xs">(inactive)</span>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {row.categoryName ? `${row.categoryName} · ` : ""}
                    {row.unitType}
                    {row.sku ? ` · ${row.sku}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <MoneyDisplay value={row.price} currency={currency} className="text-sm font-medium" />
                  {canWrite ? (
                    <>
                      <Button type="button" size="sm" variant="ghost" onClick={() => { setEditing(row); setCreating(false); }}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <ActiveToggle id={row.id} isActive={row.isActive} action={setActiveAction} />
                    </>
                  ) : null}
                </div>
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

function ServiceForm({
  initial,
  categories,
  onSubmit,
  onCancel,
  onDone,
}: {
  initial?: ServiceRow;
  categories: { id: string; name: string }[];
  onSubmit: (input: ServiceInput) => Promise<ActionResult<unknown>>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [unitType, setUnitType] = useState<string>(initial?.unitType ?? "FLAT");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onSubmit({
        name,
        description,
        sku,
        categoryId,
        unitType: unitType as ServiceInput["unitType"],
        price,
        isActive,
      });
      if (result.success) {
        showSuccessToast(initial ? "Service updated" : "Service created");
        onDone();
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="svc-name" label="Name" value={name} onChange={setName} />
        <TextField id="svc-sku" label="SKU (optional)" value={sku} onChange={setSku} />
        <SelectField
          id="svc-category"
          label="Category"
          value={categoryId}
          onChange={setCategoryId}
          options={[{ value: "", label: "— None —" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <SelectField
          id="svc-unit"
          label="Unit type"
          value={unitType}
          onChange={setUnitType}
          options={UNIT_TYPES.map((u) => ({ value: u, label: u }))}
        />
        <TextField id="svc-price" label="Price" value={price} onChange={setPrice} hint="e.g. 150.00" />
      </div>
      <TextareaField id="svc-desc" label="Description (optional)" value={description} onChange={setDescription} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 rounded" />
        Active (available in the Quote Builder)
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
