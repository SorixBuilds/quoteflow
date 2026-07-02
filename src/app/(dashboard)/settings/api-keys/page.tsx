import type { Metadata } from "next";

import {
  PageContent,
  PageHeader,
} from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { listKeysForOrg } from "@/features/api-keys/queries";
import {
  ApiKeysManager,
  type ApiKeyRow,
} from "@/features/api-keys/components/ApiKeysManager";

export const metadata: Metadata = { title: "API Keys" };

/**
 * API key management (§21.5, §13) — OWNER only. Create, rotate, and revoke the
 * hashed, scoped keys that authenticate `/api/v1/*` callers. Dates are
 * formatted here (server) so the client component receives plain strings.
 */
export default async function ApiKeysPage() {
  await requireRole(["OWNER"]);
  const keys = await listKeysForOrg();

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const rows: ApiKeyRow[] = keys.map((key) => ({
    id: key.id,
    name: key.name,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
    isActive: key.isActive,
    createdAt: formatDate(key.createdAt),
    lastUsedAt: key.lastUsedAt ? formatDate(key.lastUsedAt) : null,
  }));

  return (
    <>
      <PageHeader
        title="API Keys"
        breadcrumb={["Settings", "API Keys"]}
        description="Let external tools read your QuoteFlow data through the versioned public API. Each key gets only the scopes you grant it."
      />
      <PageContent>
        <ApiKeysManager keys={rows} />
      </PageContent>
    </>
  );
}
