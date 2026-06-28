"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { showErrorToast } from "@/components/shared/SuccessToast";
import { createInvoice } from "@/features/invoices/actions";

/** Create-invoice form against a Job (Phase 5, §21). */
export function CreateInvoiceForm({
  job,
}: {
  job: { id: string; customerName: string; quoteNumber: string; quoteTotal: string; currency: string };
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(job.quoteTotal);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createInvoice({ jobId: job.id, amount, dueDate });
      if (result.success) router.push(`/invoices/${result.data.id}`);
      else {
        setError(result.error);
        showErrorToast(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-card max-w-lg space-y-4 rounded-lg border p-6">
      <div className="text-sm">
        <p>
          <span className="text-muted-foreground">Customer: </span>
          {job.customerName}
        </p>
        <p>
          <span className="text-muted-foreground">Quote: </span>
          {job.quoteNumber} (<MoneyDisplay value={job.quoteTotal} currency={job.currency} />)
        </p>
      </div>
      <div>
        <Label htmlFor="inv-amount">Invoice amount</Label>
        <Input id="inv-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <p className="text-muted-foreground mt-1 text-xs">
          Raise a deposit, progress, or final invoice — you can create several against one job.
        </p>
      </div>
      <div>
        <Label htmlFor="inv-due">Due date (optional)</Label>
        <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-44" />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create invoice"}
        </Button>
      </div>
    </form>
  );
}
