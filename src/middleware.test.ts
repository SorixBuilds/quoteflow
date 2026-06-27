import { describe, expect, it, vi } from "vitest";

// Make the Auth.js middleware wrapper a passthrough so we can call the route
// handler directly with a synthetic request.
vi.mock("@/lib/auth", () => ({
  auth: (handler: unknown) => handler,
}));

import middleware from "@/middleware";

type Session = {
  user: { id: string; organizationId: string; role: string; isActive: boolean };
} | null;

const handler = middleware as unknown as (req: {
  nextUrl: URL;
  auth: Session;
}) => Response;

function request(path: string, auth: Session = null): Response {
  return handler({ nextUrl: new URL(`http://localhost${path}`), auth });
}

function session(role: string, isActive = true): Session {
  return { user: { id: "u1", organizationId: "o1", role, isActive } };
}

function location(res: Response): string | null {
  return res.headers.get("location");
}

describe("middleware route gate (§6.6, §11)", () => {
  it("allows public routes with no session", () => {
    expect(location(request("/"))).toBeNull();
    expect(location(request("/api/auth/session"))).toBeNull();
  });

  it("allows guest-only routes when signed out", () => {
    expect(location(request("/login"))).toBeNull();
  });

  it("redirects guest-only routes to the dashboard when signed in", () => {
    const res = request("/login", session("STAFF"));
    expect(location(res)).toBe("http://localhost/dashboard");
  });

  it("redirects the bootstrap route to the dashboard when signed in", () => {
    const res = request("/setup", session("OWNER"));
    expect(location(res)).toBe("http://localhost/dashboard");
  });

  it("redirects unauthenticated access to a protected route to login with callbackUrl", () => {
    const res = request("/settings/account", null);
    const url = new URL(location(res) as string);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("callbackUrl")).toBe("/settings/account");
  });

  it("allows a permitted role on a protected route", () => {
    expect(location(request("/dashboard", session("FIELD")))).toBeNull();
    expect(location(request("/settings/team", session("OWNER")))).toBeNull();
  });

  it("redirects an insufficient role to the dashboard with the toast flag", () => {
    const res = request("/settings/team", session("STAFF"));
    const url = new URL(location(res) as string);
    expect(url.pathname).toBe("/dashboard");
    expect(url.searchParams.get("error")).toBe("insufficient-role");
  });

  it("forces logout for a deactivated user holding a valid session", () => {
    const res = request("/dashboard", session("OWNER", false));
    const url = new URL(location(res) as string);
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("reason")).toBe("deactivated");
  });
});
