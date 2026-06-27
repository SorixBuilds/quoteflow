import type { NextConfig } from "next";

/**
 * Security headers (§15). Applied to every route.
 *
 * The CSP is deliberately pragmatic for Phase 3: it locks down framing, base
 * URI, and form targets, and restricts default/img/font/connect to same-origin,
 * while permitting the inline styles/scripts the Next.js App Router emits during
 * hydration. A nonce-based script policy is a worthwhile future hardening step
 * but requires per-request nonce plumbing through middleware — out of scope here.
 */
const isProd = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
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
]
  .join("; ")
  .concat(isProd ? "; upgrade-insecure-requests" : "");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
