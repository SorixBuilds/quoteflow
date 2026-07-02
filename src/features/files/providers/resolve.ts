import { env } from "@/lib/env";
import { providerRegistry } from "@/lib/providers/registry";
import { PROVIDER_KEYS } from "@/lib/providers/types";
import { UrlPasteProvider } from "@/features/files/providers/url-paste-provider";
import { VercelBlobProvider } from "@/features/files/providers/vercel-blob-provider";
import type { StorageProvider } from "@/features/files/providers/types";

/**
 * Storage provider resolver (Phase 6, §6.1, §14.6).
 *
 * The sole branch point for which storage adapter is active. Reads
 * `STORAGE_PROVIDER` (default "url"). Both adapters are now written: the
 * zero-cost `UrlPasteProvider` is live, and the funded `VercelBlobProvider` is
 * selectable but its byte upload stays gated behind installing `@vercel/blob`
 * (§14.13) — selecting it surfaces a clear `ProviderNotConfiguredError` from
 * `store()` rather than silently dropping the file. No consumer of
 * `resolveStorageProvider()` ever branches on which one is active (§6.1).
 */
function defaultStorageProvider(): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case "url":
      return new UrlPasteProvider();
    case "vercel-blob":
      return new VercelBlobProvider();
  }
}

export function resolveStorageProvider(): StorageProvider {
  return providerRegistry.resolve(PROVIDER_KEYS.storage, defaultStorageProvider);
}
