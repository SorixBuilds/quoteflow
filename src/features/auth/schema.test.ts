import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  createPasswordSchema,
  createTeammateSchema,
  loginSchema,
  setupSchema,
} from "@/features/auth/schema";

describe("loginSchema", () => {
  it("normalizes email to lowercase and trims", () => {
    const result = loginSchema.parse({
      email: "  User@Example.COM ",
      password: "anything",
    });
    expect(result.email).toBe("user@example.com");
  });

  it("rejects an invalid email", () => {
    expect(
      loginSchema.safeParse({ email: "nope", password: "x" }).success,
    ).toBe(false);
  });

  it("requires a non-empty password", () => {
    expect(
      loginSchema.safeParse({ email: "a@b.com", password: "" }).success,
    ).toBe(false);
  });
});

describe("password policy (§9.3)", () => {
  it("rejects passwords under 10 characters", () => {
    expect(createPasswordSchema().safeParse("short1").success).toBe(false);
  });

  it("rejects trivially common passwords", () => {
    expect(createPasswordSchema().safeParse("password123").success).toBe(false);
    expect(createPasswordSchema().safeParse("12345678").success).toBe(false);
  });

  it("accepts a sufficiently long, uncommon password", () => {
    expect(
      createPasswordSchema().safeParse("river-tractor-galaxy").success,
    ).toBe(true);
  });

  it("rejects a password that echoes contextual terms (org/email)", () => {
    const schema = createPasswordSchema(["acmecorp"]);
    expect(schema.safeParse("acmecorp").success).toBe(false);
    expect(schema.safeParse("a-totally-different-pass").success).toBe(true);
  });
});

describe("setupSchema", () => {
  it("accepts a complete, valid bootstrap payload", () => {
    const result = setupSchema.safeParse({
      organizationName: "Acme Plumbing",
      ownerName: "Dana Owner",
      email: "dana@acme.test",
      password: "river-tractor-galaxy",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a weak password", () => {
    const result = setupSchema.safeParse({
      organizationName: "Acme",
      ownerName: "Dana",
      email: "dana@acme.test",
      password: "password",
    });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema (§9.4)", () => {
  const base = {
    currentPassword: "old-password-123",
    newPassword: "river-tractor-galaxy",
    confirmPassword: "river-tractor-galaxy",
  };

  it("accepts a valid change", () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
  });

  it("rejects mismatched confirmation", () => {
    const result = changePasswordSchema.safeParse({
      ...base,
      confirmPassword: "river-tractor-galaxie",
    });
    expect(result.success).toBe(false);
  });

  it("rejects reusing the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "river-tractor-galaxy",
      newPassword: "river-tractor-galaxy",
      confirmPassword: "river-tractor-galaxy",
    });
    expect(result.success).toBe(false);
  });
});

describe("createTeammateSchema (§9.5)", () => {
  it("accepts a valid teammate with a schema role", () => {
    const result = createTeammateSchema.safeParse({
      name: "Sam Staff",
      email: "sam@acme.test",
      role: "STAFF",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown role (e.g. the old 4-role names)", () => {
    expect(
      createTeammateSchema.safeParse({
        name: "Sam",
        email: "sam@acme.test",
        role: "SALES_REP",
      }).success,
    ).toBe(false);
  });
});
