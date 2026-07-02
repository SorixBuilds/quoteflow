import { logger } from "@/lib/logger";
import { ProviderResolutionError } from "@/lib/providers/types";

/**
 * Provider Registry — the single dependency-injection seam for every Phase 6
 * provider (§6, §6.1).
 *
 * This is the *only* place provider selection is centralized. A subsystem
 * resolver (`resolveEmailProvider()`, `resolveAiProvider()`, …) calls
 * `resolve(key, defaultFactory)`; it never instantiates a concrete provider
 * directly and never branches on which one is active. The registry returns:
 *   1. a test/DI **override** if one was registered for the slot, else
 *   2. the subsystem's **default factory** (its zero-cost adapter selection).
 *
 * Why a registry rather than each resolver just calling `new XProvider()`:
 *   - **Dependency injection** — a test (or a future composition root) swaps a
 *     provider for a slot via `override()`, so a consuming action under test
 *     never touches real infrastructure. This is how §6.1's "future provider
 *     replacement" requirement is satisfied without editing call sites.
 *   - **Graceful fallback** — if an override throws while constructing (a
 *     misconfigured funded adapter, say), the registry logs and falls back to
 *     the still-present default factory, so a bad override degrades to the
 *     zero-cost path instead of taking down the request.
 *   - **One audit point** — "what can be swapped, and how" is this file, not a
 *     scattering of `new` calls.
 *
 * Feature flags are intentionally *not* consulted here: a flag (`ai`, `portal`,
 * …) is per-organization business gating evaluated asynchronously through the
 * Configuration Service (`lib/config/flags`), whereas provider selection is
 * process-wide infrastructure read from env. The two compose at the action
 * layer — `requireFeatureFlag("ai")` then `resolveAiProvider()` — and are kept
 * as separate concerns by design (§16.2, §16.10).
 *
 * Resolution is synchronous and cheap; construct a fresh provider per resolve
 * (providers are thin and stateless — the stateful ones, e.g. the rate limiter,
 * keep their state in a module-level store, not in the instance).
 */

type ProviderFactory<T> = () => T;

class ProviderRegistry {
  private readonly overrides = new Map<string, ProviderFactory<unknown>>();

  /**
   * Install a DI override for a slot. Used by tests and by any future
   * composition root that wants to force a specific implementation. Returns a
   * disposer that removes exactly this override, so a test can scope a swap to
   * one block.
   */
  override<T>(key: string, factory: ProviderFactory<T>): () => void {
    this.overrides.set(key, factory as ProviderFactory<unknown>);
    return () => {
      if (this.overrides.get(key) === (factory as ProviderFactory<unknown>)) {
        this.overrides.delete(key);
      }
    };
  }

  /** Remove an override for a slot, if any (falls back to the default factory). */
  clearOverride(key: string): void {
    this.overrides.delete(key);
  }

  /** Whether a slot currently has a DI override installed. */
  hasOverride(key: string): boolean {
    return this.overrides.has(key);
  }

  /**
   * Resolve the active provider for a slot.
   *
   * @param key            the provider slot (use `PROVIDER_KEYS`)
   * @param defaultFactory the subsystem's zero-cost default selection; required,
   *                       so a slot always has a working implementation and
   *                       `resolve` can never return `undefined`.
   */
  resolve<T>(key: string, defaultFactory: ProviderFactory<T>): T {
    const override = this.overrides.get(key) as ProviderFactory<T> | undefined;
    if (!override) {
      return defaultFactory();
    }
    try {
      return override();
    } catch (error) {
      // A broken override must never take down a request — degrade to the
      // zero-cost default and record why (§6 "graceful fallback").
      logger.error("Provider override failed; falling back to default", {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return defaultFactory();
    }
  }

  /** Test helper — drop every override and return to pure defaults. */
  reset(): void {
    this.overrides.clear();
  }
}

/**
 * The process-wide registry singleton. A module-level instance (not a fresh one
 * per import) so an override installed anywhere is seen everywhere, the same
 * singleton discipline `lib/db.ts` uses for Prisma.
 */
export const providerRegistry = new ProviderRegistry();

export { ProviderResolutionError };
export type { ProviderFactory };
