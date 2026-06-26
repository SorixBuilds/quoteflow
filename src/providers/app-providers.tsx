import type { ReactNode } from "react";

import { Toaster } from "sonner";

import { QueryProvider } from "@/providers/query-provider";

/**
 * Single composition point for every app-wide provider. New cross-cutting
 * providers (theme, session, etc.) are added here so the root layout stays
 * thin.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <Toaster richColors position="top-right" />
    </QueryProvider>
  );
}
