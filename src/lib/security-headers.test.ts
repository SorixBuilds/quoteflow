import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, buildSecurityHeaders } from "@/lib/security-headers";

/**
 * §22 header policy, asserted rather than eyeballed. The frame/base/object/form
 * lockdowns and same-origin defaults hold in every environment; HSTS and
 * `upgrade-insecure-requests` are production-only (they must not pin localhost
 * to https in dev).
 */

const get = (isProd: boolean, key: string) =>
  buildSecurityHeaders(isProd).find((h) => h.key === key)?.value;

describe("buildContentSecurityPolicy", () => {
  it("locks framing, object embedding, base URI, and form targets", () => {
    const csp = buildContentSecurityPolicy(true);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("default-src 'self'");
  });

  it("adds upgrade-insecure-requests only in production", () => {
    expect(buildContentSecurityPolicy(true)).toContain("upgrade-insecure-requests");
    expect(buildContentSecurityPolicy(false)).not.toContain("upgrade-insecure-requests");
  });

  it("permits unsafe-eval only in development (HMR runtime)", () => {
    expect(buildContentSecurityPolicy(false)).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy(true)).not.toContain("'unsafe-eval'");
  });
});

describe("buildSecurityHeaders", () => {
  it("always sends the core hardening headers", () => {
    expect(get(false, "X-Content-Type-Options")).toBe("nosniff");
    expect(get(false, "X-Frame-Options")).toBe("DENY");
    expect(get(false, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(get(false, "Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(get(false, "Permissions-Policy")).toContain("geolocation=()");
  });

  it("sends HSTS only in production, never in dev/http", () => {
    expect(get(true, "Strict-Transport-Security")).toContain("max-age=63072000");
    expect(get(true, "Strict-Transport-Security")).toContain("includeSubDomains");
    expect(get(false, "Strict-Transport-Security")).toBeUndefined();
  });
});
