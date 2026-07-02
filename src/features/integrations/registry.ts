/**
 * Integration provider registry (Phase 6, §6.1, §20.6).
 *
 * The contract every third-party integration implements, and the lookup-by-key
 * registry that resolves one. Unlike the other five adapters there is no default
 * implementation: the registry starts **empty** (§5 Non-Goals — zero live
 * integrations built in Phase 6). Adding a real integration (QuickBooks, Google
 * Calendar, Stripe, …) is one new file implementing `IntegrationProvider` plus
 * one entry pushed into `integrationRegistry` — no change to the lookup, the
 * connect/disconnect actions (Step 11), or the Settings UI.
 *
 * Credential-handling rule, binding for every future adapter (§20.9): a
 * provider's returned `config` is non-secret metadata only (e.g. "which company
 * file is linked"), never an OAuth token or API key. Secrets live in a
 * server-only secret store, never in `Integration.config`. Stated here, in the
 * framework, so no future adapter quietly violates it.
 */

/** Non-secret connection metadata persisted to `Integration.config` (§20.9). */
export type IntegrationConfig = Record<string, unknown>;

export interface IntegrationConnectResult {
  status: "CONNECTED" | "ERROR";
  config?: IntegrationConfig;
}

export interface IntegrationProvider {
  /** Stable key matching `Integration.provider`, e.g. "quickbooks". */
  key: string;
  displayName: string;
  /** Runs the provider-specific OAuth/credential flow; never the registry's job. */
  connect(
    organizationId: string,
    authPayload: unknown,
  ): Promise<IntegrationConnectResult>;
  disconnect(organizationId: string): Promise<void>;
}

/**
 * The registry. Empty in Phase 6 by design. A `const` array rather than a
 * mutable singleton because integrations are known at build time, not registered
 * at runtime — adding one is a code change, reviewed like any other.
 */
export const integrationRegistry: readonly IntegrationProvider[] = [];

/**
 * Resolve a provider by key. Returns `undefined` rather than throwing for an
 * unknown key, so a stale UI referencing a since-removed integration fails
 * gracefully (the calling action maps `undefined` to a typed `ActionResult`
 * failure, not a 500 — §20.10).
 */
export function findIntegrationProvider(
  key: string,
): IntegrationProvider | undefined {
  return integrationRegistry.find((p) => p.key === key);
}

/** The keys of every registered integration — for the Settings → Integrations list. */
export function listIntegrationKeys(): string[] {
  return integrationRegistry.map((p) => p.key);
}
