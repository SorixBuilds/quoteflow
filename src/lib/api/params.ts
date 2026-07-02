import type { z } from "zod";

import { ApiError } from "@/lib/api/error";

/**
 * Shared request-parsing and response-envelope helpers for `/api/v1/*`
 * (§21.6, §21.10, §21.11). Pure — no DB, no auth — so every rule here is
 * unit-testable in isolation.
 *
 * Pagination is capped offset-based (page size ≤ 100), the same posture the
 * internal `<DataTable>` chose (§23), for the same scale-appropriate reason.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type ListParams = {
  page: number;
  pageSize: number;
  /** Prisma `skip` derived from page/pageSize. */
  skip: number;
};

/** A positive integer query param, or its default; anything else is a 422. */
function positiveInt(url: URL, name: string, fallback: number): number {
  const rawValue = url.searchParams.get(name);
  if (rawValue === null || rawValue === "") return fallback;
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1) {
    throw new ApiError(422, "invalid_parameter", `"${name}" must be a positive integer.`);
  }
  return value;
}

/** Parse `page`/`pageSize` (§21.11): defaults 1/25, `pageSize` capped at 100. */
export function parseListParams(url: URL): ListParams {
  const page = positiveInt(url, "page", 1);
  const pageSize = Math.min(positiveInt(url, "pageSize", DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/**
 * An optional enum-valued filter (e.g. `status`). A value outside the closed
 * set is a 422 naming the parameter — never silently ignored, so a caller's
 * typo doesn't masquerade as an empty result.
 */
export function parseEnumParam<T extends string>(
  url: URL,
  name: string,
  allowed: readonly T[],
): T | undefined {
  const value = url.searchParams.get(name);
  if (value === null || value === "") return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new ApiError(
      422,
      "invalid_parameter",
      `"${name}" must be one of: ${allowed.join(", ")}.`,
    );
  }
  return value as T;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An optional UUID-valued filter (e.g. `customerId`). Malformed → 422; the
 * value's *existence* is never checked here — a foreign id simply matches
 * nothing under the handler's `organizationId` scope (IDOR-safe by query).
 */
export function parseUuidParam(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name);
  if (value === null || value === "") return undefined;
  if (!UUID.test(value)) {
    throw new ApiError(422, "invalid_parameter", `"${name}" must be a UUID.`);
  }
  return value;
}

/**
 * A path `[id]` segment. Malformed ids 404 (not 422): the caller asked for a
 * resource that cannot exist, and we never distinguish "malformed" from
 * "not yours" from "absent" (§21.9's no-enumeration posture).
 */
export function requireUuid(id: string): string {
  if (!UUID.test(id)) {
    throw new ApiError(404, "not_found", "No such resource.");
  }
  return id;
}

/** 404 every detail handler throws for a missing/foreign row — one shape. */
export function notFound(): ApiError {
  return new ApiError(404, "not_found", "No such resource.");
}

/** The §21.6 list envelope: `{ data, pagination: { page, pageSize, total } }`. */
export function listResponse<T>(
  data: T[],
  pagination: { page: number; pageSize: number; total: number },
): Response {
  return Response.json({ data, pagination });
}

/** The single-resource envelope: `{ data }`. */
export function itemResponse<T>(data: T): Response {
  return Response.json({ data });
}

/** The write-endpoint success envelope: `{ data }` with 201 Created. */
export function createdResponse<T>(data: T): Response {
  return Response.json({ data }, { status: 201 });
}

/**
 * Parse and validate a write request's JSON body against the SAME Zod schema
 * the internal feature already defines (§21.10 — no second validation layer).
 * Malformed JSON → 400; a schema violation → 422 carrying the first
 * human-readable issue, mirroring `toActionError`'s Zod mapping.
 */
export async function parseJsonBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<z.output<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "The request body must be valid JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      422,
      "validation_error",
      parsed.error.issues[0]?.message ?? "The request body is invalid.",
    );
  }
  return parsed.data;
}
