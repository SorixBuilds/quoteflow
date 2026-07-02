import { z } from "zod";

/**
 * Webhook subscription validation (§7.2.4, §20/§21). The delivery target must be
 * an https URL (an outbound webhook posts to a third party; plaintext http is
 * rejected). `subscribedEvents` is an open, additive taxonomy (free-text event
 * names like "quote.accepted"), validated as a non-empty set of bounded strings.
 */

/** https-only delivery target — no plaintext http for outbound server-to-server posts. */
const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https:\/\//i.test(value), {
    message: "Webhook URL must be https.",
  });

export const createWebhookSchema = z.object({
  url: httpsUrl,
  subscribedEvents: z
    .array(z.string().trim().min(1).max(100))
    .min(1, "Subscribe to at least one event.")
    .transform((events) => Array.from(new Set(events))),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
