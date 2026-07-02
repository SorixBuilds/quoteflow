import { z } from "zod";

/**
 * Integration connection validation (§7.2.6, §20.9). `config` is **non-secret
 * metadata only** — the binding §20.9 credential rule forbids storing a raw
 * secret, API key, or OAuth token in this JSON field. Real credentials live in a
 * server-only secret store, never here. This schema therefore validates `config`
 * as a plain JSON object and exists in part to document that boundary at the
 * persistence edge.
 */

export const INTEGRATION_STATUSES = ["NOT_CONNECTED", "CONNECTED", "ERROR"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const connectIntegrationSchema = z.object({
  provider: z.string().trim().min(1).max(60),
  /** Non-secret configuration metadata only (§20.9) — e.g. linked-account labels. */
  config: z.record(z.string(), z.unknown()).optional(),
});

export type ConnectIntegrationInput = z.infer<typeof connectIntegrationSchema>;
