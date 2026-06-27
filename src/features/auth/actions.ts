"use server";

import { randomBytes } from "node:crypto";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";

import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/password";
import { logAuthEvent } from "@/lib/audit-log";
import {
  clearAttempts,
  getRetryDelayMs,
  recordFailedAttempt,
} from "@/lib/rate-limit";
import { getCurrentUser, requireActiveUser } from "@/features/auth/queries";
import {
  changePasswordSchema,
  createPasswordSchema,
  createTeammateSchema,
  loginSchema,
  registerSchema,
  setupSchema,
} from "@/features/auth/schema";
import type { ActionResult } from "@/types";

/**
 * All authentication Server Actions (§21 rule 1, §23). Each public entry point
 * validates its input with Zod before doing anything else (§21 rule 4); each
 * protected one asserts the caller first (§21 rule 5) and re-checks the
 * database for sensitive writes (§7.6). UI never talks to Prisma directly.
 *
 * The generic failure copy below is deliberately identical across causes to
 * avoid user enumeration (§15).
 */

const GENERIC_LOGIN_ERROR = "Invalid email or password";
const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_CURRENCY = "USD";

// --- internal helpers (auth-action support only) ---------------------------

async function getClientIp(): Promise<string> {
  const hdrs = await headers();
  const forwarded = hdrs.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return hdrs.get("x-real-ip")?.trim() || "unknown";
}

/** Turn an organization name into a URL-safe slug base. */
function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "organization"
  );
}

/** Find a slug not already taken (§27 addendum: slug is `@unique`). */
async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;
  // Bounded, low-volume path (bootstrap / occasional registration).
  while (await db.organization.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

/** A random temporary password that comfortably satisfies the §9.3 policy. */
function generateTemporaryPassword(): string {
  // 18 url-safe chars — well over the 10-char minimum, not in the denylist.
  return randomBytes(14).toString("base64url").slice(0, 18);
}

/**
 * Create an Organization + its first OWNER in a single transaction (§12.4
 * step 4). Required-but-uncollected Organization fields are derived/defaulted
 * per the §27 addendum. Shared by bootstrap and public registration.
 */
async function provisionOrgAndOwner(input: {
  organizationName: string;
  ownerName: string;
  email: string;
  password: string;
}): Promise<{ organizationId: string; ownerId: string }> {
  const passwordHash = await hashPassword(input.password);
  const slug = await ensureUniqueSlug(slugify(input.organizationName));

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        slug,
        timezone: DEFAULT_TIMEZONE,
        currency: DEFAULT_CURRENCY,
        settings: {},
      },
    });
    const owner = await tx.user.create({
      data: {
        organizationId: organization.id,
        name: input.ownerName,
        email: input.email,
        passwordHash,
        role: "OWNER",
        isActive: true,
      },
    });
    return { organizationId: organization.id, ownerId: owner.id };
  });
}

// --- bootstrap (§12.4) ------------------------------------------------------

export async function bootstrapOrganization(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  // Self-gating: the wizard only ever runs against an empty database (§12.3).
  if ((await db.organization.count()) > 0) {
    return { success: false, error: "Setup has already been completed." };
  }

  // Contextual password check (§9.3): reject echoing the org/owner identity.
  const contextual = createPasswordSchema([
    data.organizationName,
    data.ownerName,
    data.email,
  ]).safeParse(data.password);
  if (!contextual.success) {
    return {
      success: false,
      error: contextual.error.issues[0]?.message ?? "Weak password",
    };
  }

  const { organizationId, ownerId } = await provisionOrgAndOwner(data);
  logAuthEvent("bootstrap.success", { userId: ownerId, organizationId });

  // Reuse the login session-issuance pipeline (§12.4 step 5).
  try {
    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Account was created; auto-login somehow failed — send them to login.
      redirect("/login");
    }
    throw error;
  }
  redirect("/dashboard");
}

// --- public registration (§12.3, flag-gated) --------------------------------

export async function registerOrganization(
  input: unknown,
): Promise<ActionResult<null>> {
  // Server-side enforcement of the flag — never just hidden in the UI (§19).
  if (!env.ALLOW_PUBLIC_REGISTRATION) {
    logAuthEvent("register.blocked", { ip: await getClientIp() });
    return {
      success: false,
      error: "Public registration is currently disabled.",
    };
  }

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const data = parsed.data;

  const contextual = createPasswordSchema([
    data.organizationName,
    data.ownerName,
    data.email,
  ]).safeParse(data.password);
  if (!contextual.success) {
    return {
      success: false,
      error: contextual.error.issues[0]?.message ?? "Weak password",
    };
  }

  try {
    const { organizationId, ownerId } = await provisionOrgAndOwner(data);
    logAuthEvent("register.success", { userId: ownerId, organizationId });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "That email or organization is already registered.",
      };
    }
    throw error;
  }

  try {
    await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }
    throw error;
  }
  redirect("/dashboard");
}

// --- login (§6.1) -----------------------------------------------------------

export async function signInAction(
  input: unknown,
): Promise<ActionResult<null>> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    // Same generic copy — never reveal which field failed (§15).
    return { success: false, error: GENERIC_LOGIN_ERROR };
  }
  const { email, password } = parsed.data;
  const callbackUrl =
    typeof (input as { callbackUrl?: unknown })?.callbackUrl === "string"
      ? (input as { callbackUrl: string }).callbackUrl
      : "/dashboard";

  const ip = await getClientIp();
  const rateKey = `${email}:${ip}`;

  // Brute-force protection: progressive delay, not lockout (§15).
  const retryMs = getRetryDelayMs(rateKey);
  if (retryMs > 0) {
    logAuthEvent("login.rate_limited", { email, ip });
    const seconds = Math.ceil(retryMs / 1000);
    return {
      success: false,
      error: `Too many attempts. Please try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
    };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      recordFailedAttempt(rateKey);
      logAuthEvent("login.failure", {
        email,
        ip,
        reason: "invalid_credentials",
      });
      return { success: false, error: GENERIC_LOGIN_ERROR };
    }
    throw error;
  }

  clearAttempts(rateKey);
  logAuthEvent("login.success", { email, ip });
  redirect(safeCallbackPath(callbackUrl));
}

/** Only permit same-origin, absolute-path redirects from `callbackUrl` (§11.3). */
function safeCallbackPath(callbackUrl: string): string {
  if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }
  return "/dashboard";
}

// --- logout (§6.2) ----------------------------------------------------------

export async function signOutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    logAuthEvent("logout", {
      userId: user.id,
      organizationId: user.organizationId,
    });
  }
  await signOut({ redirect: false });
  redirect("/login");
}

// --- password change (§9.4) -------------------------------------------------

export async function changePassword(
  input: unknown,
): Promise<ActionResult<null>> {
  // Sensitive write → authoritative DB re-check (§7.6).
  const user = await requireActiveUser();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { currentPassword, newPassword } = parsed.data;

  const contextual = createPasswordSchema([user.name, user.email]).safeParse(
    newPassword,
  );
  if (!contextual.success) {
    return {
      success: false,
      error: contextual.error.issues[0]?.message ?? "Weak password",
    };
  }

  if (!user.passwordHash) {
    return { success: false, error: "Your current password is incorrect" };
  }
  const currentMatches = await verifyPassword(
    currentPassword,
    user.passwordHash,
  );
  if (!currentMatches) {
    return { success: false, error: "Your current password is incorrect" };
  }

  const newHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });
  logAuthEvent("password.changed", {
    userId: user.id,
    organizationId: user.organizationId,
  });

  return { success: true, data: null };
}

// --- owner creates teammate (§9.5; forced-change deferred per §27 addendum) --

export type CreatedTeammate = {
  name: string;
  email: string;
  role: "OWNER" | "STAFF" | "FIELD";
  /** Shown to the Owner exactly once; never stored in plaintext (§9.5 step 2). */
  temporaryPassword: string;
};

export async function createTeammate(
  input: unknown,
): Promise<ActionResult<CreatedTeammate>> {
  // Sensitive, Owner-only write → re-check DB role/active state (§7.6, §10.3).
  const actor = await requireActiveUser();
  if (actor.role !== "OWNER") {
    logAuthEvent("teammate.created", {
      userId: actor.id,
      organizationId: actor.organizationId,
      reason: "denied_not_owner",
    });
    return { success: false, error: "Only an owner can add team members." };
  }

  const parsed = createTeammateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const { name, email, role } = parsed.data;

  // Email is unique per (organizationId, email) — scope the check to this org.
  const existing = await db.user.findUnique({
    where: {
      organizationId_email: { organizationId: actor.organizationId, email },
    },
  });
  if (existing) {
    return {
      success: false,
      error: "A team member with that email already exists.",
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  let teammateId: string;
  try {
    const teammate = await db.user.create({
      data: {
        organizationId: actor.organizationId,
        name,
        email,
        role,
        passwordHash,
        isActive: true,
      },
    });
    teammateId = teammate.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        success: false,
        error: "A team member with that email already exists.",
      };
    }
    throw error;
  }

  logAuthEvent("teammate.created", {
    userId: teammateId,
    organizationId: actor.organizationId,
    role,
  });

  return {
    success: true,
    data: { name, email, role, temporaryPassword },
  };
}
