/**
 * Global search contract (Phase 4, §17). Results are grouped by entity type and,
 * within each group, ordered by the three-tier ranking strategy.
 */
export type SearchResultType = "lead" | "customer";

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
};
