/**
 * Route classification map (§11.2) — the single source of truth for which URLs
 * are public, guest-only, bootstrap-gated, or protected, and (for protected
 * routes) the minimum role required.
 *
 * Pure logic only: no session decoding, no DB access, no React. `middleware.ts`
 * consumes this; it is also unit-tested in isolation (§19).
 *
 * Role values mirror the frozen Prisma `Role` enum (OWNER / STAFF / FIELD), per
 * the §27 addendum mapping. Kept as a local union so this module stays free of
 * any `@prisma/client` import and remains trivially edge-portable.
 */

export type RouteRole = "OWNER" | "STAFF" | "FIELD";

/** Every role — the default access set for an otherwise-unlisted protected route. */
export const ALL_ROLES: readonly RouteRole[] = ["OWNER", "STAFF", "FIELD"];

/**
 * Fully public — no session check at all (§11.2). Includes the Auth.js
 * endpoints (which must never be redirected) and the future public lead-capture
 * API. The app's smart entry point ("/") is public here and resolves where to
 * send the visitor in a server component (it needs the DB org-count, which
 * middleware deliberately cannot read — §11.4).
 */
export const PUBLIC_ROUTES: readonly string[] = [
  "/",
  "/api/auth",
  "/api/lead-capture",
  // Phase 6B Step 11: unauthenticated health probe for the deploy platform /
  // uptime monitors. Exposes no tenant data — only a coarse ok/error per check.
  "/api/health",
];

/** Guest-only — if a valid session exists, redirect to the dashboard (§11.2). */
export const GUEST_ONLY_ROUTES: readonly string[] = ["/login", "/register"];

/**
 * Customer Portal base path (Phase 6 §12.9) — its **own** authentication bucket,
 * additive to the Phase 3 classification map. Every `/portal/*` request bypasses
 * the staff session gate entirely: a valid staff session grants no portal access,
 * and the portal pages self-gate via `requirePortalSession()` (a disjoint cookie
 * + claim shape). This keeps the two planes non-interchangeable at the edge, not
 * just inside the actions.
 */
export const PORTAL_ROUTE = "/portal";

/**
 * Public API base path (Phase 6 §21, §22.1) — the third authentication plane,
 * additive like the portal's. Every `/api/v1/*` request bypasses the staff
 * session gate entirely: a staff cookie grants no API access and an API caller
 * is never redirected to a login page. Each handler self-gates via
 * `requireApiKey()` (bearer header, disjoint credential shape) and returns the
 * §21.10 JSON error envelope on failure — never a redirect.
 */
export const API_V1_ROUTE = "/api/v1";

/**
 * Guest-only AND bootstrap-gated (§11.2, §12). Treated like guest-only by
 * middleware; the page itself additionally 404s once an Organization exists.
 */
export const BOOTSTRAP_ROUTE = "/setup";

/**
 * Protected routes and their minimum-role sets (§6.7, §10.1 mapped to 3 roles).
 * Ordered most-specific prefix first, so `/settings/team` is matched before the
 * broader `/settings`.
 */
export const PROTECTED_ROUTE_ROLES: readonly {
  prefix: string;
  roles: readonly RouteRole[];
}[] = [
  { prefix: "/settings/team", roles: ["OWNER"] },
  { prefix: "/settings", roles: ALL_ROLES },
  { prefix: "/reports", roles: ["OWNER"] },
  { prefix: "/leads", roles: ["OWNER", "STAFF"] },
  { prefix: "/quotes", roles: ["OWNER", "STAFF"] },
  { prefix: "/customers", roles: ["OWNER", "STAFF"] },
  { prefix: "/jobs", roles: ALL_ROLES },
  { prefix: "/dashboard", roles: ALL_ROLES },
];

export type RouteClassification =
  | { kind: "public" }
  | { kind: "guest-only" }
  | { kind: "bootstrap" }
  | { kind: "portal" }
  | { kind: "api" }
  | { kind: "protected"; roles: readonly RouteRole[] };

/** True when `pathname` equals `prefix` or sits beneath it (`/x` matches `/x/y`). */
function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/";
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Classify a request path into exactly one bucket. Unlisted paths fall through
 * to "protected, any authenticated role" — fail closed (§15).
 */
export function classifyRoute(pathname: string): RouteClassification {
  if (PUBLIC_ROUTES.some((route) => matchesPrefix(pathname, route))) {
    return { kind: "public" };
  }

  // The Customer Portal is its own plane — classified before any staff bucket so
  // the staff session logic never applies to it (§12.9).
  if (matchesPrefix(pathname, PORTAL_ROUTE)) {
    return { kind: "portal" };
  }

  // The Public API is likewise its own plane (§21, §22.1) — key-gated inside
  // each handler, never cookie-gated or redirected at the edge.
  if (matchesPrefix(pathname, API_V1_ROUTE)) {
    return { kind: "api" };
  }

  if (matchesPrefix(pathname, BOOTSTRAP_ROUTE)) {
    return { kind: "bootstrap" };
  }

  if (GUEST_ONLY_ROUTES.some((route) => matchesPrefix(pathname, route))) {
    return { kind: "guest-only" };
  }

  const protectedMatch = PROTECTED_ROUTE_ROLES.find((entry) =>
    matchesPrefix(pathname, entry.prefix),
  );
  if (protectedMatch) {
    return { kind: "protected", roles: protectedMatch.roles };
  }

  return { kind: "protected", roles: ALL_ROLES };
}

/** Whether `role` is permitted by a protected route's allowed-role set. */
export function hasRequiredRole(
  role: RouteRole | undefined,
  allowed: readonly RouteRole[],
): boolean {
  return role !== undefined && allowed.includes(role);
}
