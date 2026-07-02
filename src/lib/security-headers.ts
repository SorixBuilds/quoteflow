/**
 * Security response headers (Phase 3 §15, hardened in Phase 6B Step 11 §22).
 *
 * Extracted from `next.config.ts` into a pure, unit-testable builder so the
 * policy is asserted by a test rather than only reviewed by eye. `next.config`
 * imports `buildSecurityHeaders()` and applies it to every route.
 *
 * The Content-Security-Policy stays deliberately pragmatic: it locks framing,
 * base URI, object embedding, and form targets, and restricts
 * default/img/font/connect to same-origin, while permitting the inline
 * styles/scripts the Next.js App Router emits during hydration. A nonce-based
 * script policy is a real future hardening step, but it requires per-request
 * nonce plumbing through middleware and cannot be verified without a browser —
 * so it is named here as deferred rather than shipped untested (§22.4).
 */

export type SecurityHeader = { key: string; value: string };

/** Build the CSP string for the given environment. */
export function buildContentSecurityPolicy(isProd: boolean): string {
  const directives = [
    "default-src 'self'",
    // 'unsafe-eval' is only needed by the dev/HMR runtime.
    `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (isProd) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}

/**
 * The full header set applied to every route. HSTS is production-only (it must
 * never be sent over plain http in local dev, where it would pin localhost to
 * https). `Cross-Origin-Opener-Policy: same-origin` isolates the browsing
 * context from cross-origin popups — a defense-in-depth addition in Step 11.
 */
export function buildSecurityHeaders(isProd: boolean): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(isProd) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
  if (isProd) {
    // Two years, subdomains included, HSTS-preload eligible — only over https.
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return headers;
}
