"use client";

import { useState, useTransition } from "react";
import type { EntityType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { showErrorToast } from "@/components/shared/SuccessToast";
import type { ActionResult } from "@/types";

/**
 * Add-note form (Phase 5, §12). Client island inside the server `NotesList`.
 * Calls the `addNote` server action and clears on success; `revalidatePath` in
 * the action refreshes the list.
 */
export function AddNoteForm({
  entityType,
  entityId,
  action,
}: {
  entityType: EntityType;
  entityId: string;
  action: (input: {
    entityType: EntityType;
    entityId: string;
    content: string;
  }) => Promise<ActionResult<{ id: string }>>;
}) {
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = content.trim();
    if (value.length === 0) return;
    startTransition(async () => {
      const result = await action({ entityType, entityId, content: value });
      if (result.success) {
        setContent("");
      } else {
        showErrorToast(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        rows={2}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a note…"
        className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending || content.trim().length === 0}>
          {isPending ? "Adding…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}
