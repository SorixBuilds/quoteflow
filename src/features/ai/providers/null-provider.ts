import type {
  AICompletionInput,
  AICompletionResult,
  AIProvider,
} from "@/features/ai/providers/types";

/**
 * The zero-cost default AI adapter (Phase 6, §16.6, §16.10).
 *
 * Calls no model and spends no tokens. It returns an empty completion with zero
 * usage, so `AiUsageLog` is correct from day one (every call logs, even when the
 * answer is empty) and cost reporting has no "before AI was enabled" gap.
 *
 * In production no user ever clicks through to this provider: when the `ai`
 * feature flag is off (the default for every organization), the assisting UI is
 * not rendered at all (§16.10). `NullAIProvider` exists so `resolveAiProvider()`
 * always returns a valid object during local development and tests without any
 * key configured — never as a path a real suggestion travels.
 */
export class NullAIProvider implements AIProvider {
  readonly name = "null";

  async complete(_input: AICompletionInput): Promise<AICompletionResult> {
    void _input;
    return { text: "", tokensUsed: 0, costEstimate: 0 };
  }
}
