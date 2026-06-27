import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/LoginForm";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/features/auth/queries";

export const metadata: Metadata = { title: "Sign in" };

// Depends on live Organization count + session — must run per request.
export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // On a brand-new (empty) deployment there is nobody to authenticate — send
  // the visitor to the one-time setup wizard instead (§12.4).
  if ((await db.organization.count()) === 0) {
    redirect("/setup");
  }

  // Guest-only: an authenticated visitor is bounced to the dashboard.
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const rawCallback = firstParam(params.callbackUrl);
  const callbackUrl =
    rawCallback && rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/dashboard";
  const reason = firstParam(params.reason);
  const notice =
    reason === "expired"
      ? "expired"
      : reason === "deactivated"
        ? "deactivated"
        : null;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-foreground text-lg font-semibold">Sign in</h2>
        <p className="text-muted-foreground text-sm">
          Welcome back. Enter your credentials to continue.
        </p>
      </div>
      <LoginForm callbackUrl={callbackUrl} notice={notice} />
    </div>
  );
}
