import type { Provider } from "@/lib/providers/types";

/**
 * AI provider contract (Phase 6, §16.6).
 *
 * The single interface every AI-assisted feature calls. Phase 6A ships the
 * interface, the zero-cost default (`NullAIProvider`), and the resolver; the
 * AI-assisted actions/components and `AiUsageLog` write are Step 14 (§29).
 *
 * AI is strictly optional system-wide (§6, §16.1): no workflow depends on a
 * provider being configured. Two independent gates keep it off by default — the
 * per-organization `ai` feature flag (business gate) and `AI_PROVIDER=null`
 * (infrastructure default). A funded `AnthropicProvider`/`OpenAiProvider` is one
 * new file (a plain `fetch`, no SDK dependency — §16.13) implementing this
 * interface; no caller changes.
 */

export interface AICompletionInput {
  prompt: string;
  /** Which assisted feature is asking — recorded on `AiUsageLog` for cost reporting. */
  feature: string;
}

export interface AICompletionResult {
  text: string;
  tokensUsed: number;
  costEstimate: number;
}

export interface AIProvider extends Provider {
  complete(input: AICompletionInput): Promise<AICompletionResult>;
}
