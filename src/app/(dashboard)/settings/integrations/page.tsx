import type { Metadata } from "next";

import {
  PageContent,
  PageHeader,
} from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { listIntegrationsForOrg } from "@/features/integrations/queries";
import { listWebhooksForOrg } from "@/features/webhooks/queries";
import { IntegrationCard } from "@/features/integrations/components/IntegrationCard";
import {
  WebhooksManager,
  type WebhookRow,
} from "@/features/webhooks/components/WebhooksManager";

export const metadata: Metadata = { title: "Integrations" };

/**
 * Settings → Integrations (§20.5, §21.5) — OWNER only. Hosts the integration
 * framework's provider cards (empty in Phase 6 by design: the registry lists
 * what's POSSIBLE, and nothing is built until a real client need funds it) and
 * outbound webhook management alongside them.
 */
export default async function IntegrationsPage() {
  await requireRole(["OWNER"]);
  const [integrations, webhooks] = await Promise.all([
    listIntegrationsForOrg(),
    listWebhooksForOrg(),
  ]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const formatDateTime = (date: Date) =>
    date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const webhookRows: WebhookRow[] = webhooks.map((hook) => ({
    id: hook.id,
    url: hook.url,
    subscribedEvents: hook.subscribedEvents,
    isActive: hook.isActive,
    createdAt: formatDate(hook.createdAt),
    recentDeliveries: hook.recentDeliveries.map((d) => ({
      id: d.id,
      eventType: d.eventType,
      status: d.status,
      responseStatusCode: d.responseStatusCode,
      attempts: d.attempts,
      createdAt: formatDateTime(d.createdAt),
    })),
  }));

  return (
    <>
      <PageHeader
        title="Integrations"
        breadcrumb={["Settings", "Integrations"]}
        description="Connect external tools and push signed webhook notifications when things happen in QuoteFlow."
      />
      <PageContent>
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-foreground text-base font-semibold">Connected apps</h2>
            {integrations.length === 0 ? (
              <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                No integrations are available yet. Each one (accounting, calendar,
                payments, SMS) is added as a single adapter when a real need calls
                for it — the framework, connection lifecycle, and this screen are
                already in place.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {integrations.map((integration) => (
                  <IntegrationCard
                    key={integration.key}
                    providerKey={integration.key}
                    displayName={integration.displayName}
                    status={integration.status}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-foreground text-base font-semibold">Webhooks</h2>
            <WebhooksManager webhooks={webhookRows} />
          </section>
        </div>
      </PageContent>
    </>
  );
}
