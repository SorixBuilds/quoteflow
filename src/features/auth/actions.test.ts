import { beforeEach, describe, expect, it, vi } from "vitest";

// Sentinel-throwing redirect so we can assert navigation targets.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Map([["x-forwarded-for", "1.2.3.4"]])),
}));
vi.mock("@/lib/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({
  requireActiveUser: vi.fn(),
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    organization: { count: vi.fn(), findUnique: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { AuthError } from "next-auth";

import {
  bootstrapOrganization,
  changePassword,
  createTeammate,
  registerOrganization,
  signInAction,
} from "@/features/auth/actions";
import { db } from "@/lib/db";
import { signIn } from "@/lib/auth";
import { requireActiveUser } from "@/features/auth/queries";
import { hashPassword } from "@/lib/password";
import { __resetRateLimitStore, recordFailedAttempt } from "@/lib/rate-limit";

const STRONG_PASSWORD = "river-tractor-galaxy";

function dbUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    organizationId: "o1",
    name: "Dana Owner",
    email: "dana@acme.test",
    passwordHash: "hash",
    role: "OWNER",
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimitStore();
});

describe("signInAction (§6.1, §15)", () => {
  it("returns the generic error on invalid credentials", async () => {
    vi.mocked(signIn).mockRejectedValueOnce(new AuthError("CredentialsSignin"));
    const result = await signInAction({
      email: "a@b.com",
      password: "whatever1",
    });
    expect(result).toEqual({
      success: false,
      error: "Invalid email or password",
    });
  });

  it("redirects to a safe callbackUrl on success", async () => {
    vi.mocked(signIn).mockResolvedValueOnce(undefined as never);
    await expect(
      signInAction({
        email: "a@b.com",
        password: "whatever1",
        callbackUrl: "/leads",
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/leads");
  });

  it("ignores an off-site callbackUrl (open-redirect guard)", async () => {
    vi.mocked(signIn).mockResolvedValueOnce(undefined as never);
    await expect(
      signInAction({
        email: "a@b.com",
        password: "whatever1",
        callbackUrl: "https://evil.example.com",
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("rate-limits after repeated failures (progressive delay)", async () => {
    for (let i = 0; i < 6; i += 1) recordFailedAttempt("a@b.com:1.2.3.4");
    const result = await signInAction({
      email: "a@b.com",
      password: "whatever1",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/Too many attempts/);
    // signIn is never even attempted while rate-limited.
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe("changePassword (§9.4)", () => {
  it("rejects an incorrect current password", async () => {
    const hash = await hashPassword("Correct-Current-1");
    vi.mocked(requireActiveUser).mockResolvedValue(
      dbUser({ passwordHash: hash }) as never,
    );

    const result = await changePassword({
      currentPassword: "Wrong-Current-9",
      newPassword: STRONG_PASSWORD,
      confirmPassword: STRONG_PASSWORD,
    });

    expect(result).toEqual({
      success: false,
      error: "Your current password is incorrect",
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it("updates the hash when the current password is correct", async () => {
    const hash = await hashPassword("Correct-Current-1");
    vi.mocked(requireActiveUser).mockResolvedValue(
      dbUser({ passwordHash: hash }) as never,
    );
    vi.mocked(db.user.update).mockResolvedValue(dbUser() as never);

    const result = await changePassword({
      currentPassword: "Correct-Current-1",
      newPassword: STRONG_PASSWORD,
      confirmPassword: STRONG_PASSWORD,
    });

    expect(result.success).toBe(true);
    expect(db.user.update).toHaveBeenCalledTimes(1);
  });
});

describe("createTeammate (§9.5, §10.3)", () => {
  it("rejects a non-owner caller even on a direct call", async () => {
    vi.mocked(requireActiveUser).mockResolvedValue(
      dbUser({ role: "STAFF" }) as never,
    );
    const result = await createTeammate({
      name: "Sam",
      email: "sam@acme.test",
      role: "STAFF",
    });
    expect(result).toEqual({
      success: false,
      error: "Only an owner can add team members.",
    });
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("creates a teammate and returns a one-time temporary password", async () => {
    vi.mocked(requireActiveUser).mockResolvedValue(
      dbUser({ role: "OWNER" }) as never,
    );
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.user.create).mockResolvedValue(
      dbUser({ id: "new-id" }) as never,
    );

    const result = await createTeammate({
      name: "Sam Field",
      email: "sam@acme.test",
      role: "FIELD",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("FIELD");
      expect(result.data.temporaryPassword.length).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("registerOrganization (§12.3)", () => {
  it("is blocked server-side when ALLOW_PUBLIC_REGISTRATION is false", async () => {
    const result = await registerOrganization({
      organizationName: "Acme",
      ownerName: "Dana",
      email: "dana@acme.test",
      password: STRONG_PASSWORD,
    });
    expect(result).toEqual({
      success: false,
      error: "Public registration is currently disabled.",
    });
  });
});

describe("bootstrapOrganization (§12.4)", () => {
  it("refuses to run once an organization exists", async () => {
    vi.mocked(db.organization.count).mockResolvedValue(1);
    const result = await bootstrapOrganization({
      organizationName: "Acme",
      ownerName: "Dana",
      email: "dana@acme.test",
      password: STRONG_PASSWORD,
    });
    expect(result).toEqual({
      success: false,
      error: "Setup has already been completed.",
    });
  });

  it("creates the org + owner and signs in on an empty database", async () => {
    vi.mocked(db.organization.count).mockResolvedValue(0);
    vi.mocked(db.organization.findUnique).mockResolvedValue(null);
    vi.mocked(db.$transaction).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (fn: any) =>
        fn({
          organization: { create: vi.fn().mockResolvedValue({ id: "org1" }) },
          user: { create: vi.fn().mockResolvedValue({ id: "owner1" }) },
        }),
    );
    vi.mocked(signIn).mockResolvedValue(undefined as never);

    await expect(
      bootstrapOrganization({
        organizationName: "Acme Co",
        ownerName: "Dana",
        email: "dana@acme.test",
        password: STRONG_PASSWORD,
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
