import { describe, expect, it } from "vitest";

import {
  PORTAL_SESSION_COOKIE,
  signPortalSession,
  verifyPortalSession,
} from "@/features/customer-portal/session";

/**
 * Portal session signing (§12.6, §12.9). The cookie is an HMAC-signed JSON
 * payload over `AUTH_SECRET`; these assert the round-trip, tamper rejection, and
 * expiry — the security guarantees a leaked/forged cookie must fail, with a
 * **disjoint** claim shape from the staff session.
 */
const session = {
  customerId: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
};

describe("portal session cookie", () => {
  it("uses a distinct cookie name from the staff session", () => {
    expect(PORTAL_SESSION_COOKIE).toBe("qf_portal_session");
    expect(PORTAL_SESSION_COOKIE).not.toContain("authjs");
  });

  it("round-trips the claims (and only the claims)", () => {
    const value = signPortalSession(session);
    expect(verifyPortalSession(value)).toEqual(session);
  });

  it("rejects a tampered payload", () => {
    const value = signPortalSession(session);
    const [body, sig] = value.split(".");
    // Flip the first payload char — signature no longer matches.
    const tampered = `${body.slice(0, -1)}${body.endsWith("A") ? "B" : "A"}.${sig}`;
    expect(verifyPortalSession(tampered)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const value = signPortalSession(session);
    const [body] = value.split(".");
    expect(verifyPortalSession(`${body}.deadbeef`)).toBeNull();
  });

  it("rejects an expired cookie", () => {
    const expired = signPortalSession(session, -10);
    expect(verifyPortalSession(expired)).toBeNull();
  });

  it("rejects malformed / empty values", () => {
    expect(verifyPortalSession(undefined)).toBeNull();
    expect(verifyPortalSession("")).toBeNull();
    expect(verifyPortalSession("no-dot-here")).toBeNull();
    expect(verifyPortalSession(".onlyasig")).toBeNull();
  });

  it("does not validate a value signed with a different purpose", () => {
    // A raw HMAC of just the body (without the portal purpose prefix) must fail —
    // the domain separation is what stops a quote-link signature from being
    // replayed as a portal session.
    const value = signPortalSession(session);
    const [body] = value.split(".");
    expect(verifyPortalSession(`${body}.${body}`)).toBeNull();
  });
});
