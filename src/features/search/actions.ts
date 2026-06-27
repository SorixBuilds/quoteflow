"use server";

import { db } from "@/lib/db";
import { requireCompanyScope } from "@/lib/permissions";
import { rankResults } from "@/features/search/ranking";
import type { SearchResult, SearchResults } from "@/features/search/types";

/**
 * Global search (Phase 4, §17). Company-scoped via `requireCompanyScope()`, then
 * a broad case-insensitive prefetch per searchable entity (Lead, Customer),
 * ranked in memory by the three-tier strategy. New searchable entities (Quote,
 * Job) join by adding one searcher here once those modules exist.
 */

const MIN_QUERY_LENGTH = 2;
const PREFETCH_LIMIT = 50;
const PER_ENTITY_LIMIT = 8;

/** OR clause matching name/email/phone with a case-insensitive contains. */
function containsAny(query: string) {
  const contains = { contains: query, mode: "insensitive" as const };
  return [{ name: contains }, { email: contains }, { phone: contains }];
}

export async function globalSearch(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return { leads: [], customers: [] };

  const { organizationId } = await requireCompanyScope();

  const [leadRows, customerRows] = await Promise.all([
    db.lead.findMany({
      where: { organizationId, OR: containsAny(q) },
      take: PREFETCH_LIMIT,
      select: { id: true, name: true, email: true, phone: true },
    }),
    db.customer.findMany({
      where: { organizationId, OR: containsAny(q) },
      take: PREFETCH_LIMIT,
      select: { id: true, name: true, email: true, phone: true },
    }),
  ]);

  const leads: SearchResult[] = rankResults(
    leadRows,
    q,
    (r) => ({ name: r.name, email: r.email, phone: r.phone }),
    PER_ENTITY_LIMIT,
  ).map((r) => ({
    id: r.id,
    type: "lead",
    label: r.name,
    sublabel: r.email ?? r.phone ?? undefined,
    href: `/leads/${r.id}`,
  }));

  const customers: SearchResult[] = rankResults(
    customerRows,
    q,
    (r) => ({ name: r.name, email: r.email, phone: r.phone }),
    PER_ENTITY_LIMIT,
  ).map((r) => ({
    id: r.id,
    type: "customer",
    label: r.name,
    sublabel: r.email ?? r.phone ?? undefined,
    href: `/customers/${r.id}`,
  }));

  return { leads, customers };
}
