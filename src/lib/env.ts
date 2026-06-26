import { z } from "zod";

/**
 * Typed, validated environment access.
 *
 * Phase 1 only needs framework-level variables. Feature variables
 * (DATABASE_URL, AUTH_SECRET, …) are added to this schema as the features
 * that consume them land — see .env.example for the planned set.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
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
