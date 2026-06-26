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
