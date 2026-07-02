/**
 * Provider foundation barrel (Phase 6, §6.1).
 *
 * Re-exports the generic dependency-injection registry and the shared provider
 * contracts. It deliberately does **not** re-export the per-subsystem resolvers
 * (`resolveEmailProvider`, `resolveAiProvider`, …): those live in their own
 * subsystem folders (§8) and importing them here would couple `lib/` to
 * `features/`, inverting the dependency direction. A consumer imports the
 * registry/keys/types from here and the specific resolver from its subsystem.
 *
 *   import { providerRegistry, PROVIDER_KEYS } from "@/lib/providers";
 *   import { resolveEmailProvider } from "@/features/email/providers/resolve";
 */
export { providerRegistry } from "@/lib/providers/registry";
export type { ProviderFactory } from "@/lib/providers/registry";
export {
  PROVIDER_KEYS,
  ProviderResolutionError,
  ProviderNotConfiguredError,
} from "@/lib/providers/types";
export type { Provider, ProviderKey } from "@/lib/providers/types";
