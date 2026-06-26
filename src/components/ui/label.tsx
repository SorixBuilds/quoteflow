import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Form label primitive. Native `<label>` (no Radix dependency, per §22) themed
 * with the QuoteFlow tokens.
 */
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn(
        "text-foreground text-sm leading-none font-medium select-none",
        className,
      )}
      {...props}
    />
  );
});
Label.displayName = "Label";

export { Label };
