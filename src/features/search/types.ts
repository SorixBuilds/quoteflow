/**
 * Global search contract (Phase 4 §17, extended Phase 5 §26). Results are grouped
 * by entity type and, within each group, ordered by the three-tier ranking
 * strategy. Phase 5 adds Quote (by number), Job (by customer name), and Invoice
 * (by number) as new adapters behind the same contract.
 */
export type SearchResultType = "lead" | "customer" | "quote" | "job" | "invoice";

export type SearchResult = {
  id: string;
  type: SearchResultType;
  label: string;
  sublabel?: string;
  href: string;
};

export type SearchResults = {
  leads: SearchResult[];
  customers: SearchResult[];
  quotes: SearchResult[];
  jobs: SearchResult[];
  invoices: SearchResult[];
};
