import type { EntityType } from "@prisma/client";
import { StickyNote } from "lucide-react";

import { EmptyState } from "@/components/shared/EmptyState";
import { requireSession } from "@/features/auth/queries";
import { getNotesForEntity, type NoteEntry } from "@/features/notes/queries";
import { addNote } from "@/features/notes/actions";
import { AddNoteForm } from "@/features/notes/components/AddNoteForm";

/**
 * Polymorphic notes panel (Phase 5, §12). Embedded unmodified by every entity
 * detail view's Notes tab:
 *
 *   <NotesList entityType="LEAD" entityId={lead.id} />
 *
 * Server component scopes the read to the caller's org; the add form is a thin
 * client component that calls the `addNote` action.
 */

export function NotesListView({ notes }: { notes: NoteEntry[] }) {
  if (notes.length === 0) {
    return (
      <EmptyState
        icon={StickyNote}
        title="No notes yet"
        description="Add the first note for this record below."
      />
    );
  }
  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-md border p-3">
          <p className="text-foreground text-sm whitespace-pre-wrap">
            {note.content}
          </p>
          <p className="text-muted-foreground mt-1.5 text-xs">
            {note.authorName} · {note.createdAt.toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}

export async function NotesList({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const session = await requireSession();
  const notes = await getNotesForEntity(session.organizationId, entityType, entityId);
  return (
    <div className="space-y-4">
      <AddNoteForm entityType={entityType} entityId={entityId} action={addNote} />
      <NotesListView notes={notes} />
    </div>
  );
}
