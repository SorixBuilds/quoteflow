import { env } from "@/lib/env";
import { providerRegistry } from "@/lib/providers/registry";
import { PROVIDER_KEYS, ProviderNotConfiguredError } from "@/lib/providers/types";
import { NullAIProvider } from "@/features/ai/providers/null-provider";
import type { AIProvider } from "@/features/ai/providers/types";

/**
 * AI provider resolver (Phase 6, §6.1, §16.6).
 *
 * The sole branch point for which AI adapter is active. Reads `AI_PROVIDER`
 * (default "null"). The funded "anthropic"/"openai" adapters are deferred to
 * Step 14; selecting one before it exists raises a clear
 * `ProviderNotConfiguredError` (§16.13). Note this resolver does *not* check the
 * `ai` feature flag — that per-organization gate is enforced at the action layer
 * (`requireFeatureFlag("ai")`) before resolution, keeping the two concerns
 * separate (§16.2).
 */
function defaultAiProvider(): AIProvider {
  switch (env.AI_PROVIDER) {
    case "null":
      return new NullAIProvider();
    case "anthropic":
    case "openai":
      throw new ProviderNotConfiguredError(
        PROVIDER_KEYS.ai,
        "A funded AI adapter is wired in Phase 6B Step 14. Set AI_PROVIDER=null until then.",
      );
  }
}

export function resolveAiProvider(): AIProvider {
  return providerRegistry.resolve(PROVIDER_KEYS.ai, defaultAiProvider);
}
