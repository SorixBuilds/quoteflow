import { z } from "zod";

/**
 * Authentication Zod schemas — the single validation source of truth, parsed on
 * both the client (inline form feedback, §17) and the server (every Server
 * Action, §21 rule 4). No business logic or DB access here.
 */

/** Schema roles (§10.1, mapped onto the frozen 3-role enum — see §27 addendum). */
export const ROLE_VALUES = ["OWNER", "STAFF", "FIELD"] as const;

/** Minimum password length (§9.3). Favors length over forced complexity. */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Small denylist of trivially weak passwords (§9.3). Checked case-insensitively.
 * Deliberately tiny — this is a guardrail against the laziest choices, not a
 * substitute for length.
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "letmein123",
  "iloveyou1",
  "adminadmin",
  "quoteflow1",
]);

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email address")
  .transform((value) => value.toLowerCase());

const personName = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(120, "Name is too long");

/**
 * Build a password schema enforcing the §9.3 policy. Pass contextual terms
 * (organization name, owner email, etc.) to additionally reject passwords that
 * trivially echo them — applied server-side where that context is known.
 */
export function createPasswordSchema(contextDenylist: string[] = []) {
  const extra = contextDenylist
    .map((term) => term.trim().toLowerCase())
    .filter((term) => term.length >= 4);

  return z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    )
    .max(200, "Password is too long")
    .refine(
      (value) => !COMMON_PASSWORDS.has(value.toLowerCase()),
      "That password is too common — choose something less guessable",
    )
    .refine(
      (value) => !extra.includes(value.toLowerCase()),
      "Password must not match your name, email, or organization",
    );
}

/** Default password policy for client-side form validation. */
export const passwordSchema = createPasswordSchema();

/** Login — password is only checked for presence here; correctness is bcrypt's job. */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

/** One-time bootstrap setup wizard (§12.4). */
export const setupSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters")
    .max(120, "Organization name is too long"),
  ownerName: personName,
  email,
  password: passwordSchema,
});

/** Public self-registration (§12.3) — same inputs as setup; flag-gated. */
export const registerSchema = setupSchema;

/** Authenticated password change (§9.4). */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

/** Owner-creates-teammate (§9.5). The temporary password is generated server-side. */
export const createTeammateSchema = z.object({
  name: personName,
  email,
  role: z.enum(ROLE_VALUES),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SetupInput = z.infer<typeof setupSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateTeammateInput = z.infer<typeof createTeammateSchema>;
