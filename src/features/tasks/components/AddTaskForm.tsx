"use client";

import { useState, useTransition } from "react";
import type { EntityType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showErrorToast } from "@/components/shared/SuccessToast";
import type { ActionResult } from "@/types";

/** Add-task form (Phase 5, §12). Client island inside the server `TaskList`. */
export function AddTaskForm({
  entityType,
  entityId,
  action,
}: {
  entityType: EntityType;
  entityId: string;
  action: (input: {
    entityType: EntityType;
    entityId: string;
    title: string;
    dueDate?: string;
  }) => Promise<ActionResult<{ id: string }>>;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = title.trim();
    if (value.length === 0) return;
    startTransition(async () => {
      const result = await action({
        entityType,
        entityId,
        title: value,
        dueDate: dueDate || undefined,
      });
      if (result.success) {
        setTitle("");
        setDueDate("");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-[12rem] flex-1">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task…"
        />
      </div>
      <Input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="w-40"
      />
      <Button type="submit" size="sm" disabled={isPending || title.trim().length === 0}>
        {isPending ? "Adding…" : "Add task"}
      </Button>
    </form>
  );
}
