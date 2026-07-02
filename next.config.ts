import type { NextConfig } from "next";

import { buildSecurityHeaders } from "./src/lib/security-headers";

/**
 * Security headers (§15, hardened in Phase 6B Step 11 §22) plus response
 * hardening. The header policy lives in `src/lib/security-headers.ts` as a
 * pure, unit-tested builder; this config just applies it to every route.
 * `poweredByHeader: false` removes the `X-Powered-By: Next.js` fingerprint.
 */
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: buildSecurityHeaders(isProd) }];
  },
};

export default nextConfig;
