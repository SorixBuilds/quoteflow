import type { Metadata } from "next";
import Link from "next/link";
import { Hammer } from "lucide-react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { requirePortalSession } from "@/features/customer-portal/session";
import { listPortalJobs } from "@/features/customer-portal/queries";

export const metadata: Metadata = { title: "Jobs" };

export default async function PortalJobsPage() {
  const session = await requirePortalSession();
  const jobs = await listPortalJobs(session);

  return (
    <div className="space-y-4">
      <h1 className="text-foreground text-xl font-semibold">Jobs</h1>

      {jobs.length === 0 ? (
        <EmptyState icon={Hammer} title="No jobs yet" description="Scheduled and completed work will appear here." />
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link
                href={`/portal/jobs/${job.id}`}
                className="hover:bg-accent/40 flex items-center gap-3 px-4 py-3 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">Job {job.reference}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {job.scheduledDate
                      ? `Scheduled ${job.scheduledDate.toLocaleDateString()}`
                      : "Not scheduled"}
                    {job.completedAt ? ` · Completed ${job.completedAt.toLocaleDateString()}` : ""}
                  </p>
                </div>
                <StatusBadge status={job.status} variant="job" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
