"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { SelectField, TextField } from "@/features/settings/components/fields";
import type { CustomerInput } from "@/features/customers/schema";
import type { CustomerDetail } from "@/features/customers/queries";
import type { ActionResult } from "@/types";

/**
 * Customer create/edit form (Phase 5, §15). Address is captured as a small
 * structured sub-form that serializes to the single `Json` column. Used both for
 * inline creation on the list screen and for editing on the detail screen.
 */
export function CustomerForm({
  initial,
  onSubmit,
  onCancel,
  onDone,
  submitLabel,
}: {
  initial?: Pick<CustomerDetail, "name" | "type" | "email" | "phone" | "address">;
  onSubmit: (input: CustomerInput) => Promise<ActionResult<unknown>>;
  onCancel?: () => void;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const addr = (initial?.address ?? {}) as Record<string, string>;
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<string>(initial?.type ?? "INDIVIDUAL");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [street, setStreet] = useState(addr.street ?? "");
  const [city, setCity] = useState(addr.city ?? "");
  const [state, setState] = useState(addr.state ?? "");
  const [postal, setPostal] = useState(addr.postal ?? "");
  const [country, setCountry] = useState(addr.country ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSubmit({
        name,
        type: type as CustomerInput["type"],
        email,
        phone,
        address: { street, city, state, postal, country },
      });
      if (result.success) {
        showSuccessToast(initial ? "Customer updated" : "Customer created");
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
        <TextField id="cust-name" label="Name" value={name} onChange={setName} />
        <SelectField
          id="cust-type"
          label="Type"
          value={type}
          onChange={setType}
          options={[
            { value: "INDIVIDUAL", label: "Individual" },
            { value: "BUSINESS", label: "Business" },
          ]}
        />
        <TextField id="cust-email" label="Email" value={email} onChange={setEmail} type="email" />
        <TextField id="cust-phone" label="Phone" value={phone} onChange={setPhone} />
      </div>
      <fieldset className="space-y-3">
        <legend className="text-muted-foreground text-xs font-medium">Address (optional)</legend>
        <TextField id="cust-street" label="Street" value={street} onChange={setStreet} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField id="cust-city" label="City" value={city} onChange={setCity} />
          <TextField id="cust-state" label="State / Region" value={state} onChange={setState} />
          <TextField id="cust-postal" label="Postal code" value={postal} onChange={setPostal} />
          <TextField id="cust-country" label="Country" value={country} onChange={setCountry} />
        </div>
      </fieldset>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : (submitLabel ?? "Save customer")}
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
