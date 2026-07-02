/**
 * Provider Adapter Pattern — shared contracts (Phase 6, §6, §6.1).
 *
 * Phase 6 routes every subsystem that *could* one day depend on a paid service
 * or a swappable engine (email, file storage, AI, integrations, rate limiting,
 * document rendering) through a small, named interface with one zero-cost
 * default shipped today. Funding/replacing a provider later is a config change
 * plus one new adapter file — never a change to the feature code that calls the
 * interface (§6.1's four-part convention).
 *
 * This module holds the cross-cutting pieces every adapter shares: the
 * `Provider` marker (a stable `name`, used for logging and the
 * SENT-vs-SIMULATED distinction email relies on), the registry key list, and
 * the two error types resolution can raise. The concrete interfaces
 * (`EmailProvider`, `StorageProvider`, …) live in their own subsystem folders,
 * exactly as §8/§6.1 place them.
 *
 * Server-only by convention: providers front infrastructure and must never be
 * instantiated from a Client Component (resolve them inside a server action).
 */

/**
 * Every provider implementation carries a stable, human-readable `name`. It is
 * never used to branch business logic (that would defeat §6.1's rule that no
 * consuming module checks which provider is active) — only for observability
 * (`logger` context) and the one legitimate distinction the architecture draws:
 * a "console"/"null"/"url" default reports a *simulated* outcome, while a funded
 * provider reports a *real* one (§11.6's SIMULATED vs SENT).
 */
export interface Provider {
  readonly name: string;
}

/**
 * The closed set of provider slots the registry knows about. Adding a seventh
 * provider is one entry here plus one resolver — the same additive discipline
 * the rest of Phase 6 follows. Keys are stable strings so a test or a future DI
 * wiring can target a slot without importing the subsystem.
 */
export const PROVIDER_KEYS = {
  email: "email",
  storage: "storage",
  ai: "ai",
  rateLimiter: "rate-limiter",
  documentRenderer: "document-renderer",
  integration: "integration",
} as const;

export type ProviderKey = (typeof PROVIDER_KEYS)[keyof typeof PROVIDER_KEYS];

/**
 * Raised when a slot is resolved but neither an override nor a default factory
 * is available for it — a wiring bug, surfaced loudly rather than returning
 * `undefined` into a feature.
 */
export class ProviderResolutionError extends Error {
  constructor(public readonly key: string) {
    super(`No provider registered for "${key}".`);
    this.name = "ProviderResolutionError";
  }
}

/**
 * Raised by a default that is intentionally a placeholder until its feature step
 * wires the real engine — e.g. the document renderer before `@react-pdf/renderer`
 * is installed in Phase 6B Step 2, or a funded adapter selected by env before it
 * is written. Distinct from `ProviderResolutionError` (a wiring bug) because this
 * is an *expected, documented* "not yet available" state, surfaced as a clear
 * message rather than a generic crash.
 */
export class ProviderNotConfiguredError extends Error {
  constructor(
    public readonly key: string,
    detail?: string,
  ) {
    super(
      `Provider "${key}" is selected but not configured in this build.` +
        (detail ? ` ${detail}` : ""),
    );
    this.name = "ProviderNotConfiguredError";
  }
}
