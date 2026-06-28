"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { EmptyState } from "@/components/shared/EmptyState";
import { TextField } from "@/features/settings/components/fields";
import type { ServiceCategoryRow } from "@/features/catalog/queries";
import type { ServiceCategoryInput } from "@/features/catalog/schema";
import type { ActionResult } from "@/types";

type CreateAction = (input: ServiceCategoryInput) => Promise<ActionResult<{ id: string }>>;
type UpdateAction = (id: string, input: ServiceCategoryInput) => Promise<ActionResult<null>>;

/** Service Category CRUD manager (Phase 5, §19). OWNER-write, STAFF read-only. */
export function ServiceCategoryManager({
  rows,
  canWrite,
  createAction,
  updateAction,
}: {
  rows: ServiceCategoryRow[];
  canWrite: boolean;
  createAction: CreateAction;
  updateAction: UpdateAction;
}) {
  const [editing, setEditing] = useState<ServiceCategoryRow | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setCreating(true);
              setEditing(null);
            }}
          >
            New category
          </Button>
        </div>
      ) : null}

      {creating ? (
        <CategoryForm
          onCancel={() => setCreating(false)}
          onSubmit={(input) => createAction(input)}
          onDone={() => setCreating(false)}
        />
      ) : null}

      {rows.length === 0 && !creating ? (
        <EmptyState title="No categories yet" description="Group your services by category." />
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((row) =>
            editing?.id === row.id ? (
              <li key={row.id} className="p-3">
                <CategoryForm
                  initial={row}
                  onCancel={() => setEditing(null)}
                  onSubmit={(input) => updateAction(row.id, input)}
                  onDone={() => setEditing(null)}
                />
              </li>
            ) : (
              <li key={row.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {row.serviceCount} service{row.serviceCount === 1 ? "" : "s"} · order {row.sortOrder}
                  </p>
                </div>
                {canWrite ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(row);
                      setCreating(false);
                    }}
                  >
                    <Pencil className="size-4" /> Edit
                  </Button>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function CategoryForm({
  initial,
  onSubmit,
  onCancel,
  onDone,
}: {
  initial?: ServiceCategoryRow;
  onSubmit: (input: ServiceCategoryInput) => Promise<ActionResult<unknown>>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await onSubmit({ name, sortOrder: Number(sortOrder) });
      if (result.success) {
        showSuccessToast(initial ? "Category updated" : "Category created");
        onDone();
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-3">
      <TextField id="cat-name" label="Name" value={name} onChange={setName} />
      <TextField
        id="cat-order"
        label="Sort order"
        type="number"
        value={sortOrder}
        onChange={setSortOrder}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
