/**
 * Three-tier search ranking (Phase 4, §17). Earlier tiers always outrank later
 * ones regardless of count: exact (1) → prefix (2) → contains (3). Matching is
 * case-insensitive across name and email, and digit-normalized for phone so
 * "(555) 123-4567" matches a query of "5551234567".
 *
 * V1 ranks in memory over a single case-insensitive `contains` fetch — the same
 * ordering the spec's three-sequential-query description produces, chosen so
 * phone normalization works without raw SQL. The documented `pg_trgm` upgrade
 * (§17) replaces this with a similarity score behind the same contract.
 */

export type MatchFields = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type Tier = 1 | 2 | 3 | null;

/** Strip every non-digit character for phone comparison. */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function matchTier(query: string, fields: MatchFields): Tier {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const qDigits = normalizePhone(query);

  const name = (fields.name ?? "").toLowerCase();
  const email = (fields.email ?? "").toLowerCase();
  const phone = normalizePhone(fields.phone ?? "");
  const phoneEligible = qDigits.length > 0 && phone.length > 0;

  if (name === q || email === q || (phoneEligible && phone === qDigits)) {
    return 1;
  }
  if (
    name.startsWith(q) ||
    email.startsWith(q) ||
    (phoneEligible && phone.startsWith(qDigits))
  ) {
    return 2;
  }
  if (
    name.includes(q) ||
    email.includes(q) ||
    (phoneEligible && phone.includes(qDigits))
  ) {
    return 3;
  }
  return null;
}

/**
 * Rank rows into tier order, dropping non-matches and capping the result.
 * Stable within a tier (preserves the incoming DB order). Pure — unit-tested.
 */
export function rankResults<T>(
  rows: T[],
  query: string,
  getFields: (row: T) => MatchFields,
  limit: number,
): T[] {
  return rows
    .map((row, index) => ({ row, index, tier: matchTier(query, getFields(row)) }))
    .filter((x): x is { row: T; index: number; tier: 1 | 2 | 3 } => x.tier !== null)
    .sort((a, b) => a.tier - b.tier || a.index - b.index)
    .slice(0, limit)
    .map((x) => x.row);
}
