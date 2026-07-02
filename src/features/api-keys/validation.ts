import { z } from "zod";

import { API_SCOPES } from "@/features/api-keys/key";

/**
 * API-key creation validation (§7.2.3, §21.8). Scopes must be a non-empty subset
 * of the fixed, closed scope list — never "all by default" — enforcing
 * least-privilege at the validation boundary. Duplicates are collapsed.
 */
export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Give the key a name.").max(120),
  scopes: z
    .array(z.enum(API_SCOPES))
    .min(1, "Grant at least one scope.")
    .transform((scopes) => Array.from(new Set(scopes))),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
