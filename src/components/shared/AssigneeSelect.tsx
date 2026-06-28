"use client";

import { useTransition } from "react";

import { cn } from "@/lib/utils";

/**
 * Role-filtered assignee picker (Phase 5, §13, §23). One component for both
 * assignment surfaces — Lead assignment (filtered to STAFF) and Job assignment
 * (filtered to FIELD) — parameterized only by the `users` list the caller passes
 * (the caller does the role filtering server-side). On change it calls the
 * provided async action and shows a pending state; it never decides who is
 * assignable on its own.
 */

export type AssignableUser = { id: string; name: string };

export function AssigneeSelect({
  users,
  value,
  onAssign,
  disabled,
  unassignedLabel = "Unassigned",
  id = "assignee",
  className,
}: {
  users: AssignableUser[];
  value: string | null;
  onAssign: (userId: string | null) => Promise<void> | void;
  disabled?: boolean;
  unassignedLabel?: string;
  id?: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      id={id}
      value={value ?? ""}
      disabled={disabled || isPending}
      onChange={(e) => {
        const next = e.target.value === "" ? null : e.target.value;
        startTransition(async () => {
          await onAssign(next);
        });
      }}
      className={cn(
        "border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50",
        className,
      )}
    >
      <option value="">{unassignedLabel}</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
