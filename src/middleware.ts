import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { classifyRoute, hasRequiredRole } from "@/lib/auth-routes";

/**
 * Edge-of-app route gate (§11). The single central place that classifies every
 * request and enforces the Route Protection Flow (§6.6–6.7). It performs NO
 * database work beyond decoding the JWT (§11.4) and NO record-level scoping —
 * that is a Server Action responsibility (§10.4).
 *
 * Runs on the Node.js runtime so it can import the `auth` helper (which pulls in
 * Prisma via the Credentials provider) without bundling Prisma for the Edge
 * runtime — the approved primary approach for this phase.
 */
export default auth((req) => {
  const { nextUrl } = req;
  const { pathname, search } = nextUrl;
  const session = req.auth;
  const isLoggedIn = Boolean(session?.user);

  const route = classifyRoute(pathname);

  // Public: never gated.
  if (route.kind === "public") {
    return NextResponse.next();
  }

  // Customer Portal (§12.9): a wholly separate auth plane. The staff session is
  // irrelevant here — never grant access from it, never redirect a (possibly
  // signed-in staff) visitor away from it. Each /portal/* page self-gates via
  // `requirePortalSession()` against its own disjoint cookie.
  if (route.kind === "portal") {
    return NextResponse.next();
  }

  // Public API (§21, §22.1): the third auth plane. Never cookie-gated here —
  // every /api/v1/* handler self-gates via requireApiKey() and answers with the
  // §21.10 JSON error envelope, never a login redirect.
  if (route.kind === "api") {
    return NextResponse.next();
  }

  // Guest-only (incl. bootstrap): a signed-in user has no business here.
  if (route.kind === "guest-only" || route.kind === "bootstrap") {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
    return NextResponse.next();
  }

  // Protected from here on.
  if (!isLoggedIn || !session?.user) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  // Deactivated user holding a still-valid JWT → force logout (§6.6, §11.3).
  // Best-effort: under the JWT strategy this claim can be stale; the
  // authoritative re-check happens in sensitive Server Actions (§7.6).
  if (session.user.isActive === false) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("reason", "deactivated");
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete("authjs.session-token");
    response.cookies.delete("__Secure-authjs.session-token");
    return response;
  }

  // Insufficient role → toast-on-dashboard pattern (§11.3); never a 403 page.
  if (!hasRequiredRole(session.user.role, route.roles)) {
    const dashboardUrl = new URL("/dashboard", nextUrl);
    dashboardUrl.searchParams.set("error", "insufficient-role");
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Node.js runtime so Prisma (imported via lib/auth.ts) is available here.
  runtime: "nodejs",
  /**
   * Run on everything except Next internals and static asset files. Auth.js
   * endpoints and the public lead-capture API are matched but classified as
   * public above.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff|woff2|ttf)$).*)",
  ],
};
