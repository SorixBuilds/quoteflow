import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { providerRegistry } from "@/lib/providers/registry";
import { PROVIDER_KEYS } from "@/lib/providers/types";
import { ConsoleEmailProvider } from "@/features/email/providers/console-provider";
import { ResendEmailProvider } from "@/features/email/providers/resend-provider";
import type { EmailProvider } from "@/features/email/providers/types";

/**
 * Email provider resolver (Phase 6, §6.1, §11.6, §11.13).
 *
 * The sole branch point for which email adapter is active. Reads `EMAIL_PROVIDER`
 * (default "console"). The funded "resend" adapter (Phase 6B Step 5) is selected
 * when `EMAIL_PROVIDER=resend` AND `RESEND_API_KEY` is present; if the key is
 * missing it **degrades gracefully** to the console adapter (a logged warning,
 * not a crashed request — §11 "graceful fallback"), so a misconfigured
 * production env still records every email as SIMULATED rather than 500ing a
 * quote send.
 *
 * Goes through `providerRegistry` so tests/DI can override the slot without a
 * real provider (§6.1 "future provider replacement").
 */
function defaultEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case "console":
      return new ConsoleEmailProvider();
    case "resend":
      if (env.RESEND_API_KEY) {
        return new ResendEmailProvider(env.RESEND_API_KEY);
      }
      logger.warn(
        "EMAIL_PROVIDER=resend but RESEND_API_KEY is unset — falling back to ConsoleEmailProvider (emails will be SIMULATED).",
      );
      return new ConsoleEmailProvider();
  }
}

export function resolveEmailProvider(): EmailProvider {
  return providerRegistry.resolve(PROVIDER_KEYS.email, defaultEmailProvider);
}
