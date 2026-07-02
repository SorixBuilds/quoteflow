"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { updatePortalContactInfo } from "@/features/customer-portal/actions";
import type { PortalAccount } from "@/features/customer-portal/queries";

/**
 * Customer self-service contact form (§12.3, §12.5). The ONLY write the portal
 * exposes over a business entity — and only over `email`/`phone`/`address`. It
 * posts to `updatePortalContactInfo`, which validates with the SAME schema the
 * internal Customer module uses (§12.10). Name and customer type are read-only:
 * the portal cannot change who the customer is.
 */
export function PortalContactForm({ account }: { account: PortalAccount }) {
  const [form, setForm] = useState({
    email: account.email ?? "",
    phone: account.phone ?? "",
    street: account.address?.street ?? "",
    city: account.address?.city ?? "",
    state: account.address?.state ?? "",
    postal: account.address?.postal ?? "",
    country: account.address?.country ?? "",
  });
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await updatePortalContactInfo({
        email: form.email,
        phone: form.phone,
        address: {
          street: form.street,
          city: form.city,
          state: form.state,
          postal: form.postal,
          country: form.country,
        },
      });
      if (result.success) {
        showSuccessToast("Your details have been updated.");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-muted-foreground text-xs">Name</p>
        <p className="text-foreground text-sm font-medium">{account.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
        <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
      </div>

      <fieldset className="space-y-4">
        <legend className="text-foreground text-sm font-semibold">Address</legend>
        <Field label="Street" value={form.street} onChange={(v) => set("street", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City" value={form.city} onChange={(v) => set("city", v)} />
          <Field label="State / Region" value={form.state} onChange={(v) => set("state", v)} />
          <Field label="Postal code" value={form.postal} onChange={(v) => set("postal", v)} />
          <Field label="Country" value={form.country} onChange={(v) => set("country", v)} />
        </div>
      </fieldset>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-foreground text-sm font-medium">{label}</span>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
