"use client";

/* eslint-disable @next/next/no-img-element */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isImageUrl } from "@/features/files/types";

/**
 * URL-paste file input (Phase 4, §16). The V1 implementation of the FileRef
 * contract: the user pastes a URL; if it looks like an image we render a small
 * preview. A real upload pipeline (Vercel Blob) later replaces the input while
 * keeping the same `{ url }` value shape — no consumer change.
 *
 * `next/image` is intentionally not used: the URL is arbitrary/user-supplied and
 * not a configured remote pattern, so a plain `<img>` is correct here.
 */
export function FileUrlInput({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  placeholder = "https://…",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  const showPreview = value.trim().length > 0 && isImageUrl(value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        {showPreview ? (
          <img
            src={value}
            alt="Logo preview"
            className="size-10 shrink-0 rounded border object-contain"
          />
        ) : null}
        <Input
          id={id}
          name={id}
          type="url"
          inputMode="url"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
