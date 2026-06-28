import type { SortDir, TableParams } from "@/features/tables/types";

/**
 * Shared URL-params → Prisma translator (Phase 4, §19). The single place table
 * state becomes a Prisma query. Critically, both sorting and filtering are
 * constrained to caller-provided allowlists — URL params can never construct an
 * arbitrary `where`/`orderBy` (§19 "never arbitrary URL-driven query
 * construction"). Pure and unit-tested.
 */

export type ParseTableOptions = {
  /** Column keys that may be sorted on. A `sortBy` outside this is ignored. */
  allowedSort?: string[];
  /** Column keys that may be filtered (contains, case-insensitive). */
  allowedFilters?: string[];
  defaultPageSize?: number;
  maxPageSize?: number;
};

export type ParsedTableQuery = {
  skip: number;
  take: number;
  orderBy?: Record<string, SortDir>;
  where: Record<string, { contains: string; mode: "insensitive" }>;
  params: TableParams;
};

type ParamSource =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const value = source[key];
  return Array.isArray(value) ? value[0] : value;
}

function toPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function parseTableParams(
  source: ParamSource,
  options: ParseTableOptions = {},
): ParsedTableQuery {
  const {
    allowedSort = [],
    allowedFilters = [],
    defaultPageSize = 25,
    maxPageSize = 100,
  } = options;

  const page = toPositiveInt(read(source, "page"), 1);
  const pageSize = Math.min(
    toPositiveInt(read(source, "pageSize"), defaultPageSize),
    maxPageSize,
  );

  const rawSortBy = read(source, "sortBy");
  const sortBy =
    rawSortBy && allowedSort.includes(rawSortBy) ? rawSortBy : undefined;
  const sortDir: SortDir = read(source, "sortDir") === "asc" ? "asc" : "desc";

  const filters: Record<string, string> = {};
  const where: Record<string, { contains: string; mode: "insensitive" }> = {};
  for (const key of allowedFilters) {
    const value = read(source, key)?.trim();
    if (value) {
      filters[key] = value;
      where[key] = { contains: value, mode: "insensitive" };
    }
  }

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: sortBy ? { [sortBy]: sortDir } : undefined,
    where,
    params: { page, pageSize, sortBy, sortDir, filters },
  };
}
