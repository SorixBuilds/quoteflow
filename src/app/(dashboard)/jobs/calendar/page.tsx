import type { Metadata } from "next";

import { PageContent, PageHeader, PageLayout } from "@/features/layout/components/PageLayout";
import { requireRole } from "@/lib/permissions";
import { getJobsForCalendar } from "@/features/jobs/queries";
import { JobCalendar } from "@/features/jobs/components/JobCalendar";

export const metadata: Metadata = { title: "Job calendar" };

function parseMonth(value: string | undefined): { year: number; month: number } {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    if (month >= 0 && month <= 11) return { year, month };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export default async function JobCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole(["OWNER", "STAFF", "FIELD"]);
  const { month: monthParam } = await searchParams;
  const { year, month } = parseMonth(Array.isArray(monthParam) ? monthParam[0] : monthParam);

  const from = new Date(year, month, 1, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59);
  const jobs = await getJobsForCalendar(from, to);

  return (
    <PageLayout>
      <PageHeader title="Job calendar" breadcrumb={[{ label: "Jobs", href: "/jobs" }, "Calendar"]} />
      <PageContent>
        <JobCalendar year={year} month={month} jobs={jobs} />
      </PageContent>
    </PageLayout>
  );
}
