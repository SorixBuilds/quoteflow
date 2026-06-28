import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";

/**
 * Shared money renderer (Phase 5, §13). Formats any money value with the org's
 * ISO-4217 currency via `lib/money`. The value arrives as a string (the
 * serialized `Decimal`) or a `Decimal`; it is never reconstructed as a JS number
 * by the caller — formatting is the only place a `number` appears, inside
 * `Intl.NumberFormat`.
 */
export function MoneyDisplay({
  value,
  currency,
  locale,
  className,
}: {
  value: string | number;
  currency: string;
  locale?: string;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {formatMoney(value, currency, locale)}
    </span>
  );
}
