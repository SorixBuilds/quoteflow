import { z } from "zod";

/**
 * Typed, validated environment access.
 *
 * Variables are added to this schema as the features that consume them land —
 * see .env.example for the planned set. DATABASE_URL arrives with Phase 2;
 * AUTH_SECRET and the rest follow in their respective phases.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url(),
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
