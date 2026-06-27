import { describe, expect, it } from "vitest";

import { classifyRoute, hasRequiredRole } from "@/lib/auth-routes";

describe("route classification (§11.2)", () => {
  it("treats the entry point and Auth.js endpoints as public", () => {
    expect(classifyRoute("/").kind).toBe("public");
    expect(classifyRoute("/api/auth/session").kind).toBe("public");
    expect(classifyRoute("/api/lead-capture").kind).toBe("public");
  });

  it("treats login and register as guest-only", () => {
    expect(classifyRoute("/login").kind).toBe("guest-only");
    expect(classifyRoute("/register").kind).toBe("guest-only");
  });

  it("treats setup as bootstrap-gated", () => {
    expect(classifyRoute("/setup").kind).toBe("bootstrap");
  });

  it("protects the dashboard for any authenticated role", () => {
    const result = classifyRoute("/dashboard");
    expect(result.kind).toBe("protected");
    if (result.kind === "protected") {
      expect([...result.roles].sort()).toEqual(["FIELD", "OWNER", "STAFF"]);
    }
  });

  it("restricts team settings to OWNER (most-specific prefix wins)", () => {
    const result = classifyRoute("/settings/team");
    expect(result.kind).toBe("protected");
    if (result.kind === "protected") {
      expect(result.roles).toEqual(["OWNER"]);
    }
  });

  it("allows any role on general settings", () => {
    const result = classifyRoute("/settings/account");
    if (result.kind === "protected") {
      expect(result.roles).toContain("FIELD");
    }
  });

  it("restricts reports to OWNER and leads to OWNER/STAFF", () => {
    const reports = classifyRoute("/reports");
    const leads = classifyRoute("/leads/abc");
    if (reports.kind === "protected") expect(reports.roles).toEqual(["OWNER"]);
    if (leads.kind === "protected") {
      expect([...leads.roles].sort()).toEqual(["OWNER", "STAFF"]);
    }
  });

  it("fails closed: an unlisted path is protected for any authenticated role", () => {
    const result = classifyRoute("/something/unknown");
    expect(result.kind).toBe("protected");
  });
});

describe("hasRequiredRole", () => {
  it("permits a role in the allowed set", () => {
    expect(hasRequiredRole("OWNER", ["OWNER"])).toBe(true);
    expect(hasRequiredRole("STAFF", ["OWNER", "STAFF"])).toBe(true);
  });

  it("rejects a role outside the allowed set", () => {
    expect(hasRequiredRole("STAFF", ["OWNER"])).toBe(false);
    expect(hasRequiredRole("FIELD", ["OWNER", "STAFF"])).toBe(false);
  });

  it("rejects an undefined role", () => {
    expect(hasRequiredRole(undefined, ["OWNER"])).toBe(false);
  });
});
