import { z } from "zod";

/**
 * Typed, validated environment access.
 *
 * Variables are added to this schema as the features that consume them land —
 * see .env.example for the planned set. DATABASE_URL arrives with Phase 2;
 * AUTH_SECRET and the auth flags arrive with Phase 3 (authentication).
 *
 * Server-only module: it reads secrets (AUTH_SECRET, DATABASE_URL) and must
 * never be imported into a Client Component.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url(),

  // --- Phase 3 (authentication) ---
  // Signs/encrypts the JWT session cookie (§14). Unique per environment.
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  // Gates public self-registration (§12.3). Defaults to disabled — only the
  // public portfolio/demo deployment sets this to "true".
  ALLOW_PUBLIC_REGISTRATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // bcrypt work factor (§9.1). Externalized so it can be tuned without a code
  // change as hardware improves. Defaults to 12.
  BCRYPT_COST_FACTOR: z.coerce.number().int().min(4).max(20).default(12),

  // --- Phase 6A (provider selection — §6.1) ---
  // Each of these picks which adapter a provider resolver returns. They are the
  // *only* configuration that branches provider selection (§6.1: the resolver is
  // the sole branch point). Every one defaults to its zero-cost adapter, so an
  // existing deployment with an unchanged .env keeps working with no new value
  // set — the funded adapters stay deferred until a real client funds them
  // (§11.13/§14.13/§16.13/§21.13). The non-default ("funded") values are
  // accepted by the schema now so the swap is a pure env change later; selecting
  // one before its adapter is wired raises a clear ProviderNotConfiguredError
  // rather than failing validation here.
  //
  // Email delivery adapter. "console" = log + simulate (no email sent, the
  // frozen zero-cost posture); "resend" = funded REST delivery, wired in Step 5.
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  // Resend API key (Phase 6B Step 5). Optional — only required when
  // EMAIL_PROVIDER=resend. The production adapter (`ResendEmailProvider`) talks to
  // the Resend REST API directly via `fetch`, so no `resend` SDK is a dependency.
  // When EMAIL_PROVIDER=resend but this is unset, the resolver degrades gracefully
  // to the console adapter rather than failing a request (§11 graceful fallback).
  RESEND_API_KEY: z.string().trim().min(1).optional(),
  // The platform default `from` address used when a tenant has not configured a
  // verified `senderEmail` (must be a domain Resend has verified in production).
  EMAIL_FROM_DEFAULT: z.string().trim().email().default("no-reply@quoteflow.app"),
  // File storage adapter. "url" = store a pasted URL (same pattern as the
  // existing Organization.logoUrl); "vercel-blob" = funded binary storage,
  // wired in Step 3.
  STORAGE_PROVIDER: z.enum(["url", "vercel-blob"]).default("url"),
  // AI inference adapter. "null" = no-op, zero token spend (the default for
  // every organization); "anthropic"/"openai" = funded, wired in Step 14. AI is
  // additionally gated per-organization by the `ai` feature flag (§16.2).
  AI_PROVIDER: z.enum(["null", "anthropic", "openai"]).default("null"),
  // Public-API rate-limit store. "db" = the zero-infrastructure sliding-window
  // limiter; "upstash" = funded Redis limiter, wired in Step 12's funding
  // trigger (§21.13).
  RATE_LIMITER: z.enum(["db", "upstash"]).default("db"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables:",
    z.treeifyError(parsed.error),
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
