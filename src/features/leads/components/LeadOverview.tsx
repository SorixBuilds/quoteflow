"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyDisplay } from "@/components/shared/MoneyDisplay";
import { EmptyState } from "@/components/shared/EmptyState";
import { AssigneeSelect } from "@/components/shared/AssigneeSelect";
import { StatusTransitionMenu, type TransitionOption } from "@/components/shared/StatusTransitionMenu";
import { showErrorToast, showSuccessToast } from "@/components/shared/SuccessToast";
import { LeadForm } from "@/features/leads/components/LeadForm";
import { changeLeadStatus, reassignLead, updateLead } from "@/features/leads/actions";
import { LEAD_STATUS_LABELS, nextLeadStatuses } from "@/lib/status";
import type { LeadDetail } from "@/features/leads/queries";

type Option = { id: string; name: string };

/** Lead detail Overview tab (Phase 5, §14, §22, §23). */
export function LeadOverview({
  lead,
  sources,
  staff,
  currency,
}: {
  lead: LeadDetail;
  sources: Option[];
  staff: Option[];
  currency: string;
}) {
  const [editing, setEditing] = useState(false);

  const transitions: TransitionOption[] = nextLeadStatuses(lead.status).map((s) => ({
    value: s,
    label: `Mark ${LEAD_STATUS_LABELS[s]}`,
    requiresNote: s === "LOST",
    notePrompt: s === "LOST" ? "Reason for loss" : undefined,
    variant: s === "LOST" ? "destructive" : "default",
  }));

  if (editing) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <h2 className="mb-4 text-base font-semibold">Edit lead</h2>
        <LeadForm
          initial={lead}
          sources={sources}
          staff={staff}
          showAssignee={false}
          onSubmit={(input) => updateLead(lead.id, input)}
          onCancel={() => setEditing(false)}
          onDone={() => setEditing(false)}
          submitLabel="Save changes"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-card space-y-4 rounded-lg border p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={lead.status} variant="lead" />
            {lead.customerName ? (
              <span className="text-muted-foreground text-sm">
                Customer:{" "}
                <Link href={`/customers/${lead.customerId}`} className="text-primary hover:underline">
                  {lead.customerName}
                </Link>
              </span>
            ) : null}
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p><span className="text-muted-foreground">Phone: </span>{lead.phone}</p>
          <p><span className="text-muted-foreground">Email: </span>{lead.email ?? "—"}</p>
          <p><span className="text-muted-foreground">Source: </span>{lead.sourceName ?? "—"}</p>
          <p><span className="text-muted-foreground">Created: </span>{lead.createdAt.toLocaleDateString()}</p>
        </div>

        {lead.status === "LOST" && lead.lostReason ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Loss reason: </span>
            {lead.lostReason}
          </p>
        ) : null}

        <div className="max-w-xs space-y-1">
          <Label htmlFor="lead-assignee-select">Assigned to</Label>
          <AssigneeSelect
            id="lead-assignee-select"
            users={staff}
            value={lead.assignedToId}
            onAssign={async (userId) => {
              const result = await reassignLead(lead.id, userId);
              if (result.success) showSuccessToast("Assignment updated");
              else showErrorToast(result.error);
            }}
          />
        </div>
      </div>

      {transitions.length > 0 ? (
        <div className="bg-card rounded-lg border p-6">
          <h3 className="mb-3 text-sm font-semibold">Update status</h3>
          <StatusTransitionMenu
            variant="lead"
            options={transitions}
            onTransition={(target, note) => changeLeadStatus(lead.id, target, note)}
          />
        </div>
      ) : null}

      <section className="bg-card rounded-lg border p-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Quotes</h3>
          <Link
            href={`/quotes/new?leadId=${lead.id}`}
            className="text-primary text-sm font-medium hover:underline"
          >
            New quote
          </Link>
        </div>
        {lead.quotes.length === 0 ? (
          <EmptyState title="No quotes yet" description="Create a quote to start the conversion." />
        ) : (
          <ul className="divide-y">
            {lead.quotes.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/quotes/${q.id}`} className="text-primary text-sm font-medium hover:underline">
                  {q.quoteNumber}
                </Link>
                <div className="flex items-center gap-3">
                  <StatusBadge status={q.status} variant="quote" />
                  <MoneyDisplay value={q.total} currency={currency} className="text-sm" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
