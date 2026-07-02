import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { user: { findFirst: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/password", () => ({
  verifyPassword: vi.fn(),
  runDummyComparison: vi.fn(async () => false),
}));

import { authorizeCredentials } from "@/lib/auth";
import { db } from "@/lib/db";
import { runDummyComparison, verifyPassword } from "@/lib/password";

const activeUser = {
  id: "u1",
  organizationId: "o1",
  name: "Dana Owner",
  email: "dana@acme.test",
  passwordHash: "stored-hash",
  role: "OWNER" as const,
  isActive: true,
  lastLoginAt: null,
  // Phase 6 (§7.2) additive nullable column — mock fixture mirrors a pre-existing
  // row (null = all notification channels enabled).
  notificationPreferences: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const validCredentials = {
  email: "dana@acme.test",
  password: "river-tractor-galaxy",
};

describe("authorizeCredentials (§6.1, §9.7, §15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.update).mockResolvedValue(activeUser);
  });

  it("returns the minimal user projection for a valid, active login", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(activeUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const result = await authorizeCredentials(validCredentials);

    expect(result).toEqual({
      id: "u1",
      organizationId: "o1",
      role: "OWNER",
      isActive: true,
      name: "Dana Owner",
      email: "dana@acme.test",
    });
    // No sensitive material leaks into the returned object.
    expect(result).not.toHaveProperty("passwordHash");
    // lastLoginAt recorded.
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it("returns null for an unknown email AND still runs a comparison (timing)", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null);

    const result = await authorizeCredentials(validCredentials);

    expect(result).toBeNull();
    expect(runDummyComparison).toHaveBeenCalledTimes(1);
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("returns null for a deactivated account AND runs a comparison", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({
      ...activeUser,
      isActive: false,
    });

    const result = await authorizeCredentials(validCredentials);

    expect(result).toBeNull();
    expect(runDummyComparison).toHaveBeenCalledTimes(1);
  });

  it("returns null when the password does not match", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(activeUser);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    expect(await authorizeCredentials(validCredentials)).toBeNull();
  });

  it("returns null (and runs a comparison) when no password hash is set", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue({
      ...activeUser,
      passwordHash: null,
    });

    expect(await authorizeCredentials(validCredentials)).toBeNull();
    expect(runDummyComparison).toHaveBeenCalledTimes(1);
  });

  it("returns null (and runs a comparison) for malformed input", async () => {
    expect(await authorizeCredentials({ email: "not-an-email" })).toBeNull();
    expect(runDummyComparison).toHaveBeenCalledTimes(1);
    expect(db.user.findFirst).not.toHaveBeenCalled();
  });

  it("every failure cause yields the identical null result shape", async () => {
    vi.mocked(db.user.findFirst).mockResolvedValueOnce(null);
    const unknown = await authorizeCredentials(validCredentials);

    vi.mocked(db.user.findFirst).mockResolvedValueOnce({
      ...activeUser,
      isActive: false,
    });
    const inactive = await authorizeCredentials(validCredentials);

    vi.mocked(db.user.findFirst).mockResolvedValueOnce(activeUser);
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);
    const wrongPassword = await authorizeCredentials(validCredentials);

    expect(unknown).toBeNull();
    expect(inactive).toBeNull();
    expect(wrongPassword).toBeNull();
  });
});
