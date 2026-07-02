"use client";

import { useMemo, useReducer, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { showErrorToast } from "@/components/shared/SuccessToast";
import { SelectField, TextareaField } from "@/features/settings/components/fields";
import { CustomerForm } from "@/features/customers/components/CustomerForm";
import { createCustomer } from "@/features/customers/actions";
import { AiSuggest } from "@/features/ai/components/AiSuggest";
import { generateQuoteDraft } from "@/features/ai/actions";
import { calculateQuoteTotal, type CalcLine } from "@/features/quotes/calculations";
import { moneyToString } from "@/lib/money";
import type { BuilderCatalog } from "@/features/catalog/cache";
import {
  builderReducer,
  initialBuilderState,
  resolveLinePercent,
  type BuilderLine,
  type BuilderState,
} from "@/features/quote-builder/store";
import type { QuotePayload } from "@/features/quotes/schema";
import type { ActionResult } from "@/types";

type Option = { id: string; name: string };

/**
 * Quote Builder (Phase 5, §17). Pure client composition surface used by both
 * `/quotes/new` and `/quotes/[id]/edit`. Live totals are computed by the same
 * `calculateQuoteTotal` the server uses on save — the server recomputes
 * authoritatively, so the client total is preview-only (§5, §39). Line reordering
 * is keyboard-accessible (move up/down) and drag-and-drop, with no extra library.
 */
export function QuoteBuilder({
  mode,
  catalog,
  customers,
  currency,
  leadId,
  initial,
  onSave,
  aiEnabled = false,
}: {
  mode: "create" | "edit";
  catalog: BuilderCatalog;
  customers: Option[];
  currency: string;
  leadId?: string;
  initial?: Partial<BuilderState> & { lines?: BuilderLine[] };
  onSave: (payload: QuotePayload) => Promise<ActionResult<{ id: string }>>;
  /** The org's `ai` flag (§16.5) — the suggest affordance renders only when true. */
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(builderReducer, initialBuilderState(initial));
  const [customerOptions, setCustomerOptions] = useState<Option[]>(customers);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const calc = useMemo(() => {
    try {
      const calcLines: CalcLine[] = state.lines.map((l) => ({
        quantity: l.quantity || "0",
        unitPrice: l.unitPrice || "0",
        taxRatePercent: resolveLinePercent(catalog, l.taxRateId),
      }));
      const discount =
        state.discountType && state.discountValue
          ? { type: state.discountType, value: state.discountValue }
          : null;
      return calculateQuoteTotal(calcLines, discount);
    } catch {
      return null;
    }
  }, [state, catalog]);

  const taxRateOptions = [
    { value: "", label: catalog.taxRates.find((t) => t.isDefault) ? "Default rate" : "No tax" },
    ...catalog.taxRates.map((t) => ({ value: t.id, label: `${t.name} (${t.rate}%)` })),
  ];

  function addCatalogService(serviceId: string) {
    const svc = catalog.services.find((s) => s.id === serviceId);
    if (!svc) return;
    const defaultTax = catalog.taxRates.find((t) => t.isDefault);
    dispatch({
      type: "addCatalogLine",
      line: {
        serviceId: svc.id,
        description: svc.description ? `${svc.name} — ${svc.description}` : svc.name,
        quantity: "1",
        unitPrice: svc.price,
        taxRateId: defaultTax?.id ?? null,
      },
    });
  }

  function handleSave() {
    setError(null);
    if (!state.customerId) {
      setError("Select or create a customer first.");
      return;
    }
    const payload: QuotePayload = {
      customerId: state.customerId,
      leadId: leadId ?? null,
      items: state.lines.map((l) => ({
        serviceId: l.serviceId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        taxRateId: l.taxRateId,
      })),
      discountType: state.discountType || null,
      discountValue: state.discountValue || null,
      notes: state.notes,
      terms: state.terms,
      issueDate: state.issueDate,
      expiryDate: state.expiryDate,
    };
    startTransition(async () => {
      const result = await onSave(payload);
      if (result.success) {
        router.push(`/quotes/${result.data.id}`);
      } else {
        setError(result.error);
        showErrorToast(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Customer */}
      <section className="bg-card space-y-4 rounded-lg border p-6">
        <h2 className="text-base font-semibold">Customer</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <SelectField
              id="qb-customer"
              label="Customer"
              value={state.customerId}
              onChange={(v) => dispatch({ type: "setField", field: "customerId", value: v })}
              options={[
                { value: "", label: "— Select a customer —" },
                ...customerOptions.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
          <Button type="button" variant="outline" onClick={() => setShowNewCustomer((v) => !v)}>
            {showNewCustomer ? "Cancel" : "New customer"}
          </Button>
        </div>
        {showNewCustomer ? (
          <div className="rounded-md border p-4">
            <CustomerForm
              onSubmit={async (input) => {
                const result = await createCustomer(input);
                if (result.success) {
                  // CustomerForm doesn't know the new name; re-read from input.
                  const name = (input as { name: string }).name;
                  setCustomerOptions((prev) =>
                    [...prev, { id: result.data.id, name }].sort((a, b) => a.name.localeCompare(b.name)),
                  );
                  dispatch({ type: "setField", field: "customerId", value: result.data.id });
                }
                return result;
              }}
              onDone={() => setShowNewCustomer(false)}
              onCancel={() => setShowNewCustomer(false)}
              submitLabel="Create & select"
            />
          </div>
        ) : null}
      </section>

      {/* Line items */}
      <section className="bg-card space-y-4 rounded-lg border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Line items</h2>
          <div className="flex items-center gap-2">
            <select
              aria-label="Add from catalog"
              value=""
              onChange={(e) => {
                if (e.target.value) addCatalogService(e.target.value);
              }}
              className="border-input bg-background h-9 rounded-md border px-3 text-sm shadow-sm"
            >
              <option value="">Add from catalog…</option>
              {catalog.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => dispatch({ type: "addCustomLine" })}>
              <Plus className="size-4" /> Custom line
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {state.lines.map((line, index) => (
            <div
              key={line.key}
              draggable
              onDragStart={() => setDragKey(line.key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragKey && dragKey !== line.key) {
                  // Move the dragged line to this position via up/down steps.
                  const from = state.lines.findIndex((l) => l.key === dragKey);
                  const to = index;
                  const dir = from < to ? "down" : "up";
                  const steps = Math.abs(to - from);
                  for (let i = 0; i < steps; i++) dispatch({ type: "moveLine", key: dragKey, direction: dir });
                }
                setDragKey(null);
              }}
              className="grid grid-cols-12 items-end gap-2 rounded-md border p-2"
            >
              <div className="col-span-12 flex items-center gap-1 sm:col-span-5">
                <GripVertical className="text-muted-foreground size-4 cursor-grab" aria-hidden />
                <div className="flex-1">
                  <Label htmlFor={`desc-${line.key}`} className="sr-only">
                    Description
                  </Label>
                  <Input
                    id={`desc-${line.key}`}
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) =>
                      dispatch({ type: "updateLine", key: line.key, patch: { description: e.target.value } })
                    }
                  />
                </div>
              </div>
              <div className="col-span-3 sm:col-span-1">
                <Label htmlFor={`qty-${line.key}`} className="text-muted-foreground text-xs">
                  Qty
                </Label>
                <Input
                  id={`qty-${line.key}`}
                  value={line.quantity}
                  onChange={(e) => dispatch({ type: "updateLine", key: line.key, patch: { quantity: e.target.value } })}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Label htmlFor={`price-${line.key}`} className="text-muted-foreground text-xs">
                  Unit price
                </Label>
                <Input
                  id={`price-${line.key}`}
                  value={line.unitPrice}
                  onChange={(e) => dispatch({ type: "updateLine", key: line.key, patch: { unitPrice: e.target.value } })}
                />
              </div>
              <div className="col-span-3 sm:col-span-2">
                <Label htmlFor={`tax-${line.key}`} className="text-muted-foreground text-xs">
                  Tax
                </Label>
                <select
                  id={`tax-${line.key}`}
                  value={line.taxRateId ?? ""}
                  onChange={(e) =>
                    dispatch({ type: "updateLine", key: line.key, patch: { taxRateId: e.target.value || null } })
                  }
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm shadow-sm"
                >
                  {taxRateOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 flex items-center justify-end gap-1 sm:col-span-2">
                <span className="text-sm font-medium tabular-nums">
                  {calc ? <MoneyDisplay value={moneyToString(calc.lineTotals[index])} currency={currency} /> : "—"}
                </span>
              </div>
              <div className="col-span-12 flex justify-end gap-1 sm:col-span-12">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => dispatch({ type: "moveLine", key: line.key, direction: "up" })}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === state.lines.length - 1}
                  onClick={() => dispatch({ type: "moveLine", key: line.key, direction: "down" })}
                >
                  ↓
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => dispatch({ type: "removeLine", key: line.key })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {state.lines.length === 0 ? (
            <p className="text-muted-foreground text-sm">Add at least one line item.</p>
          ) : null}
        </div>
      </section>

      {/* Discount + totals */}
      <section className="bg-card grid gap-6 rounded-lg border p-6 sm:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Discount</h2>
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              id="qb-disc-type"
              label="Type"
              value={state.discountType}
              onChange={(v) => dispatch({ type: "setField", field: "discountType", value: v })}
              options={[
                { value: "", label: "None" },
                { value: "PERCENT", label: "Percent (%)" },
                { value: "FIXED", label: "Fixed amount" },
              ]}
            />
            <div>
              <Label htmlFor="qb-disc-value" className="text-muted-foreground text-xs">
                Value
              </Label>
              <Input
                id="qb-disc-value"
                value={state.discountValue}
                disabled={!state.discountType}
                onChange={(e) => dispatch({ type: "setField", field: "discountValue", value: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <Totals label="Subtotal" value={calc ? moneyToString(calc.subtotal) : null} currency={currency} />
          {calc && !calc.discountAmount.isZero() ? (
            <Totals label="Discount" value={`-${moneyToString(calc.discountAmount)}`} currency={currency} />
          ) : null}
          <Totals label="Tax" value={calc ? moneyToString(calc.taxAmount) : null} currency={currency} />
          <div className="flex items-center justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{calc ? <MoneyDisplay value={moneyToString(calc.total)} currency={currency} /> : "—"}</span>
          </div>
        </div>
      </section>

      {/* Notes / terms / dates */}
      <section className="bg-card grid gap-4 rounded-lg border p-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="qb-issue" className="text-muted-foreground text-xs">
            Issue date
          </Label>
          <Input
            id="qb-issue"
            type="date"
            value={state.issueDate}
            onChange={(e) => dispatch({ type: "setField", field: "issueDate", value: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="qb-expiry" className="text-muted-foreground text-xs">
            Expiry date
          </Label>
          <Input
            id="qb-expiry"
            type="date"
            value={state.expiryDate}
            onChange={(e) => dispatch({ type: "setField", field: "expiryDate", value: e.target.value })}
          />
        </div>
        <TextareaField
          id="qb-notes"
          label="Notes (visible to customer)"
          value={state.notes}
          onChange={(v) => dispatch({ type: "setField", field: "notes", value: v })}
        />
        {leadId ? (
          <AiSuggest
            enabled={aiEnabled}
            label="Suggest notes with AI"
            request={() => generateQuoteDraft(leadId)}
            onAccept={(text) =>
              dispatch({
                type: "setField",
                field: "notes",
                value: state.notes.trim() === "" ? text : `${state.notes}\n\n${text}`,
              })
            }
          />
        ) : null}
        <TextareaField
          id="qb-terms"
          label="Terms"
          value={state.terms}
          onChange={(v) => dispatch({ type: "setField", field: "terms", value: v })}
        />
      </section>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : mode === "create" ? "Create quote" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Totals({ label, value, currency }: { label: string; value: string | null; currency: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value !== null ? <MoneyDisplay value={value} currency={currency} /> : "—"}</span>
    </div>
  );
}
