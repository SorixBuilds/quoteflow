"use server";

import { db } from "@/lib/db";
import { requireCompanyScope } from "@/lib/permissions";
import { rankResults } from "@/features/search/ranking";
import type { SearchResult, SearchResults } from "@/features/search/types";

/**
 * Global search (Phase 4 §17, extended Phase 5 §26). Company-scoped via
 * `requireCompanyScope()`, then a broad case-insensitive prefetch per searchable
 * entity, ranked in memory by the three-tier strategy. Phase 5 adds Quote
 * (`quoteNumber`), Job (linked `Customer.name`), and Invoice (`invoiceNumber`)
 * as new adapters — same ranking algorithm, same org-scoping, no change to the
 * ranking core.
 */

const MIN_QUERY_LENGTH = 2;
const PREFETCH_LIMIT = 50;
const PER_ENTITY_LIMIT = 8;

const EMPTY: SearchResults = { leads: [], customers: [], quotes: [], jobs: [], invoices: [] };

/** OR clause matching name/email/phone with a case-insensitive contains. */
function containsAny(query: string) {
  const contains = { contains: query, mode: "insensitive" as const };
  return [{ name: contains }, { email: contains }, { phone: contains }];
}

export async function globalSearch(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return EMPTY;

  const { organizationId } = await requireCompanyScope();
  const contains = { contains: q, mode: "insensitive" as const };

  const [leadRows, customerRows, quoteRows, jobRows, invoiceRows] = await Promise.all([
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
    db.quote.findMany({
      where: { organizationId, quoteNumber: contains },
      take: PREFETCH_LIMIT,
      select: { id: true, quoteNumber: true, customer: { select: { name: true } } },
    }),
    db.job.findMany({
      where: { organizationId, customer: { name: contains } },
      take: PREFETCH_LIMIT,
      select: { id: true, customer: { select: { name: true } }, quote: { select: { quoteNumber: true } } },
    }),
    db.invoice.findMany({
      where: { organizationId, invoiceNumber: contains },
      take: PREFETCH_LIMIT,
      select: { id: true, invoiceNumber: true, customer: { select: { name: true } } },
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

  const quotes: SearchResult[] = rankResults(
    quoteRows,
    q,
    (r) => ({ name: r.quoteNumber }),
    PER_ENTITY_LIMIT,
  ).map((r) => ({
    id: r.id,
    type: "quote",
    label: r.quoteNumber,
    sublabel: r.customer.name,
    href: `/quotes/${r.id}`,
  }));

  const jobs: SearchResult[] = rankResults(
    jobRows,
    q,
    (r) => ({ name: r.customer.name }),
    PER_ENTITY_LIMIT,
  ).map((r) => ({
    id: r.id,
    type: "job",
    label: r.customer.name,
    sublabel: `Job · ${r.quote.quoteNumber}`,
    href: `/jobs/${r.id}`,
  }));

  const invoices: SearchResult[] = rankResults(
    invoiceRows,
    q,
    (r) => ({ name: r.invoiceNumber }),
    PER_ENTITY_LIMIT,
  ).map((r) => ({
    id: r.id,
    type: "invoice",
    label: r.invoiceNumber,
    sublabel: r.customer.name,
    href: `/invoices/${r.id}`,
  }));

  return { leads, customers, quotes, jobs, invoices };
}
