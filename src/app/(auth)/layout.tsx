import type { ReactNode } from "react";
import { Workflow } from "lucide-react";

import { siteConfig } from "@/config/site";

/**
 * Shared shell for the guest-facing auth screens (login, register, setup). Thin
 * and routing-only (§21 rule 10) — a centered card with the product mark.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-lg">
            <Workflow className="size-5" />
          </div>
          <h1 className="text-foreground mt-4 text-xl font-semibold tracking-tight">
            {siteConfig.name}
          </h1>
        </div>
        <div className="bg-card rounded-xl border p-6 shadow-sm">
          {children}
        </div>
      </div>
    </main>
  );
}
