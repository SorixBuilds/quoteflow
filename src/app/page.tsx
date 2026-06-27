import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/features/auth/queries";

// Routes on live DB + session state every request — never statically cached.
export const dynamic = "force-dynamic";

/**
 * Application entry point (§12.4 step 2). Routes the visitor by deployment and
 * session state:
 *   - empty database  → /setup (one-time bootstrap)
 *   - authenticated   → /dashboard
 *   - otherwise       → /login
 *
 * This needs the Organization count, which is why the decision lives here in a
 * server component rather than in middleware (which never queries the DB, §11.4).
 */
export default async function RootPage() {
  if ((await db.organization.count()) === 0) {
    redirect("/setup");
  }
  if (await getCurrentUser()) {
    redirect("/dashboard");
  }
  redirect("/login");
}
