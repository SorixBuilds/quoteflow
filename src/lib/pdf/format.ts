import { formatMoney } from "@/lib/money";

/**
 * Document-formatting helpers (Phase 6, §10) — pure, dependency-light functions
 * for rendering dates, addresses, and money inside PDF templates. Money formatting
 * delegates to the frozen `lib/money` surface (the single currency-formatting
 * source) so documents and on-screen `<MoneyDisplay>` never diverge.
 */

export { formatMoney };

/**
 * Format a date for a document. Uses a stable, locale-independent
 * `DD Mon YYYY` form (e.g. `28 Jun 2026`) so a rendered PDF is deterministic
 * regardless of the server's locale — important for the snapshot-style tests
 * (§10.12) and for consistent client-facing output.
 */
export function formatDocDate(value: Date | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  return `${day} ${month} ${date.getUTCFullYear()}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Flatten a `Customer.address` JSON value into address lines for display. The
 * Standard-tier address is a single freeform field (frozen Phase 2), so this is
 * tolerant: a string is returned as one line; a structured object is assembled
 * from common keys in postal order; anything else yields no lines.
 */
export function formatAddressLines(address: unknown): string[] {
  if (address === null || address === undefined) return [];
  if (typeof address === "string") {
    return address
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  if (typeof address === "object") {
    const a = address as Record<string, unknown>;
    const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
    const line1 = str("line1") || str("street") || str("address1");
    const line2 = str("line2") || str("address2") || str("unit");
    const cityLine = [str("city"), str("state") || str("region"), str("postalCode") || str("zip")]
      .filter(Boolean)
      .join(", ");
    const country = str("country");
    return [line1, line2, cityLine, country].filter(Boolean);
  }
  return [];
}
