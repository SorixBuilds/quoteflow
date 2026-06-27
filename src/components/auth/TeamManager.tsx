"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTeammate, type CreatedTeammate } from "@/features/auth/actions";
import { createTeammateSchema, ROLE_VALUES } from "@/features/auth/schema";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isSelf: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  STAFF: "Staff",
  FIELD: "Field",
};

/**
 * Owner-only team management UI (§9.5). Lists current members and creates new
 * ones via the `createTeammate` Server Action, which enforces the Owner-only
 * rule server-side (§10.3). The one-time temporary password is shown exactly
 * once, here, with a copy-it-now warning (§9.5 step 2).
 */
export function TeamManager({ members }: { members: TeamMember[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"name" | "email" | "role", string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedTeammate | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setCreated(null);

    const formData = new FormData(event.currentTarget);
    const raw = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      role: String(formData.get("role") ?? ""),
    };

    const parsed = createTeammateSchema.safeParse(raw);
    if (!parsed.success) {
      const errors: Partial<Record<"name" | "email" | "role", string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "name" | "email" | "role";
        if (key && !errors[key]) errors[key] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      const result = await createTeammate(parsed.data);
      if (result.success) {
        setCreated(result.data);
        toast.success(`${result.data.name} added to the team`);
        formRef.current?.reset();
        router.refresh();
      } else {
        setFormError(result.error);
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-foreground text-sm font-semibold">Team members</h2>
        <ul className="divide-border divide-y rounded-md border">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="text-foreground font-medium">
                  {member.name}
                  {member.isSelf && (
                    <span className="text-muted-foreground"> (you)</span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">{member.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs">
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
                {!member.isActive && (
                  <span className="text-destructive text-xs">Inactive</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-foreground text-sm font-semibold">
          Add a team member
        </h2>

        {created && (
          <div className="border-warning/40 bg-warning/10 space-y-1 rounded-md border p-4 text-sm">
            <p className="text-foreground font-medium">
              Temporary password for {created.name}
            </p>
            <p className="text-foreground font-mono text-base">
              {created.temporaryPassword}
            </p>
            <p className="text-muted-foreground text-xs">
              Copy this now — it won&apos;t be shown again. Share it with{" "}
              {created.email} so they can sign in.
            </p>
          </div>
        )}

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              aria-invalid={Boolean(fieldErrors.name)}
            />
            {fieldErrors.name && (
              <p className="text-destructive text-xs">{fieldErrors.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
            />
            {fieldErrors.email && (
              <p className="text-destructive text-xs">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              name="role"
              defaultValue="STAFF"
              className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {ROLE_VALUES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
            {fieldErrors.role && (
              <p className="text-destructive text-xs">{fieldErrors.role}</p>
            )}
          </div>

          <div aria-live="polite" className="min-h-[1.25rem]">
            {formError && (
              <p className="text-destructive text-sm">{formError}</p>
            )}
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? "Adding…" : "Add team member"}
          </Button>
        </form>
      </section>
    </div>
  );
}
