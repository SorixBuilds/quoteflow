import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Text input primitive, themed via the QuoteFlow design tokens. Built on a
 * native `<input>` (no extra dependency) and consistent with `button.tsx`.
 * `aria-invalid` drives the error styling so forms can flag field-level errors.
 */
const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
