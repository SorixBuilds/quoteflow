import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getPortalSession } from "@/features/customer-portal/session";
import { PortalLoginForm } from "@/features/customer-portal/components/PortalLoginForm";

export const metadata: Metadata = { title: "Sign in" };

/**
 * Portal sign-in (§12.7). The access link lands here with `?token=...`; we prefill
 * it and let the customer confirm, so the session-minting redemption runs as a
 * POST (server action), not on GET. An already-signed-in portal customer is sent
 * straight to their dashboard.
 */
export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getPortalSession()) {
    redirect("/portal");
  }

  const { token } = await searchParams;
  const initialToken = (Array.isArray(token) ? token[0] : token) ?? "";

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <h1 className="text-foreground text-lg font-semibold">Welcome to your portal</h1>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">
          Use the secure link the business sent you to view your quotes, invoices, and jobs.
        </p>
        <PortalLoginForm initialToken={initialToken} />
      </div>
    </main>
  );
}
