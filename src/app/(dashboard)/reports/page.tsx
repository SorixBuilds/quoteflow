import type { Metadata } from "next";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getCompanyConfig } from "@/lib/config/service";
import {
  getAgingReport,
  getCustomerLifetimeValue,
  getLeadSourceRoi,
  getLossPattern,
  getProfitabilityReport,
  getQuoteAcceptanceTrend,
  getQuoteTurnaround,
  getRevenueReport,
  getTaxSummary,
} from "@/features/reports/queries";
import { getTechnicianPerformance } from "@/features/dashboard/insights";
import { ReportsTabs } from "@/features/reports/components/ReportsTabs";
import {
  LeadSourceRoiPanel,
  LossPatternPanel,
  RevenuePanel,
  TurnaroundPanel,
} from "@/features/reports/components/ReportPanels";
import {
  AcceptanceTrendPanel,
  AgingPanel,
  CustomerLifetimeValuePanel,
  ProfitabilityPanel,
  TaxSummaryPanel,
  TechnicianUtilizationPanel,
} from "@/features/reports/components/AdvancedReportPanels";

export const metadata: Metadata = { title: "Reports" };

/**
 * Reports (Phase 5, §34). OWNER/STAFF for operational tabs; the revenue tab is
 * OWNER-only — both the tab visibility and the query are gated, so a STAFF user
 * hitting `?tab=revenue` directly is rejected by the OWNER-gated query (§29, §39).
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireRole(["OWNER", "STAFF"]);
  const sp = await searchParams;
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "turnaround";
  const config = await getCompanyConfig(session.organizationId);
  const currency = config.locale.currency;
  const isOwner = session.role === "OWNER";

  return (
    <PageLayout className="max-w-6xl">
      <PageHeader title="Reports" description="Operational and financial insight across your pipeline." />
      <PageContent>
        <ReportsTabs showRevenue={isOwner} />
        {tab === "turnaround" ? <TurnaroundPanel report={await getQuoteTurnaround()} /> : null}
        {tab === "loss" ? <LossPatternPanel rows={await getLossPattern()} /> : null}
        {tab === "sources" ? (
          <LeadSourceRoiPanel rows={await getLeadSourceRoi()} currency={currency} />
        ) : null}
        {tab === "revenue" ? (
          // getRevenueReport is OWNER-gated; a STAFF user is redirected by it.
          <RevenuePanel report={await getRevenueReport()} currency={currency} />
        ) : null}
        {/* Phase 6B Step 10 (§18) — every query below carries its own role gate. */}
        {tab === "acceptance" ? (
          <AcceptanceTrendPanel rows={await getQuoteAcceptanceTrend()} />
        ) : null}
        {tab === "utilization" ? (
          <TechnicianUtilizationPanel rows={await getTechnicianPerformance()} />
        ) : null}
        {tab === "clv" ? (
          <CustomerLifetimeValuePanel rows={await getCustomerLifetimeValue()} currency={currency} />
        ) : null}
        {tab === "aging" ? (
          <AgingPanel buckets={await getAgingReport()} currency={currency} />
        ) : null}
        {tab === "profitability" ? (
          <ProfitabilityPanel rows={await getProfitabilityReport()} currency={currency} />
        ) : null}
        {tab === "tax" ? (
          <TaxSummaryPanel rows={await getTaxSummary()} currency={currency} />
        ) : null}
      </PageContent>
    </PageLayout>
  );
}
