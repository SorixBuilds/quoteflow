"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { EmptyState } from "@/components/shared/EmptyState";
import { AssigneeSelect } from "@/components/shared/AssigneeSelect";
import { StatusTransitionMenu, type TransitionOption } from "@/components/shared/StatusTransitionMenu";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { changeJobStatus, scheduleJob, updateJobNotes } from "@/features/jobs/actions";
import { JOB_STATUS_LABELS, nextJobStatuses } from "@/lib/status";
import type { JobDetail } from "@/features/jobs/queries";

/** Job detail Overview tab (Phase 5, §20, §22, §23). */
export function JobOverview({
  job,
  technicians,
}: {
  job: JobDetail;
  technicians: { id: string; name: string }[];
}) {
  const [notes, setNotes] = useState(job.notes ?? "");
  const [scheduledDate, setScheduledDate] = useState(
    job.scheduledDate ? job.scheduledDate.toISOString().slice(0, 10) : "",
  );
  const [savingNotes, startNotes] = useTransition();
  const [savingSchedule, startSchedule] = useTransition();

  // FIELD users cannot cancel (§29); only management transitions include CANCELLED.
  const transitions: TransitionOption[] = nextJobStatuses(job.status)
    .filter((s) => job.canManage || s !== "CANCELLED")
    .map((s) => ({
      value: s,
      label: `Mark ${JOB_STATUS_LABELS[s]}`,
      requiresNote: s === "CANCELLED",
      notePrompt: s === "CANCELLED" ? "Reason for cancellation" : undefined,
      variant: s === "CANCELLED" ? "destructive" : "default",
    }));

  return (
    <div className="space-y-6">
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge status={job.status} variant="job" />
            <span className="text-muted-foreground text-sm">
              Customer:{" "}
              <Link href={`/customers/${job.customerId}`} className="text-primary hover:underline">
                {job.customerName}
              </Link>
            </span>
            <span className="text-muted-foreground text-sm">
              Quote:{" "}
              <Link href={`/quotes/${job.quoteId}`} className="text-primary hover:underline">
                {job.quoteNumber}
              </Link>
            </span>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Quote value</p>
            <p className="font-semibold">
              <MoneyDisplay value={job.quoteTotal} currency={job.currency} />
            </p>
          </div>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Scheduled: </span>
            {job.scheduledDate ? job.scheduledDate.toLocaleDateString() : "Not scheduled"}
          </p>
          <p>
            <span className="text-muted-foreground">Technician: </span>
            {job.assigneeName ?? "Unassigned"}
          </p>
          {job.completedAt ? (
            <p>
              <span className="text-muted-foreground">Completed: </span>
              {job.completedAt.toLocaleDateString()}
            </p>
          ) : null}
        </div>
      </div>

      {/* Scheduling & assignment (OWNER/STAFF only, §23) */}
      {job.canManage ? (
        <div className="bg-card space-y-4 rounded-lg border p-6">
          <h3 className="text-sm font-semibold">Schedule & assign</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="job-date">Scheduled date</Label>
              <Input
                id="job-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-44"
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={savingSchedule}
              onClick={() =>
                startSchedule(async () => {
                  const result = await scheduleJob(job.id, {
                    scheduledDate,
                    assignedToId: job.assignedToId ?? "",
                  });
                  if (result.success) showSuccessToast("Schedule updated");
                  else showErrorToast(result.error);
                })
              }
            >
              {savingSchedule ? "Saving…" : "Save date"}
            </Button>
          </div>
          <div className="max-w-xs space-y-1">
            <Label htmlFor="job-tech">Technician (field)</Label>
            <AssigneeSelect
              id="job-tech"
              users={technicians}
              value={job.assignedToId}
              unassignedLabel="Unassigned"
              onAssign={async (userId) => {
                const result = await scheduleJob(job.id, {
                  scheduledDate,
                  assignedToId: userId ?? "",
                });
                if (result.success) showSuccessToast("Technician updated");
                else showErrorToast(result.error);
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Status transitions */}
      {transitions.length > 0 ? (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="mb-3 text-sm font-semibold">Update status</h3>
          <StatusTransitionMenu
            variant="job"
            options={transitions}
            onTransition={(target, note) => changeJobStatus(job.id, target, note)}
          />
        </div>
      ) : null}

      {/* Notes */}
      <div className="bg-card space-y-2 rounded-lg border p-6">
        <h3 className="text-sm font-semibold">Job notes</h3>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={savingNotes}
            onClick={() =>
              startNotes(async () => {
                const result = await updateJobNotes(job.id, notes);
                if (result.success) showSuccessToast("Notes saved");
                else showErrorToast(result.error);
              })
            }
          >
            {savingNotes ? "Saving…" : "Save notes"}
          </Button>
        </div>
      </div>

      {/* Invoices (OWNER/STAFF only) */}
      {job.canManage ? (
        <section className="bg-card rounded-lg border p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Invoices</h3>
            <Link
              href={`/invoices/new?jobId=${job.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Create invoice
            </Link>
          </div>
          {job.invoices.length === 0 ? (
            <EmptyState title="No invoices yet" description="Raise a deposit, progress, or final invoice." />
          ) : (
            <ul className="divide-y">
              {job.invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/invoices/${inv.id}`} className="text-primary text-sm font-medium hover:underline">
                    {inv.invoiceNumber}
                  </Link>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={inv.status} variant="invoice" />
                    <MoneyDisplay value={inv.amount} currency={job.currency} className="text-sm" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
