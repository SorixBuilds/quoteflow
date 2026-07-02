import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { requirePortalSession } from "@/features/customer-portal/session";
import { getPortalJob, getPortalEntityFiles } from "@/features/customer-portal/queries";
import { PortalJobTimeline } from "@/features/customer-portal/components/PortalJobTimeline";

export const metadata: Metadata = { title: "Job" };

export default async function PortalJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePortalSession();
  const { id } = await params;

  const job = await getPortalJob(session, id);
  if (!job) notFound();

  const attachments = (await getPortalEntityFiles(session, "JOB", id)) ?? [];

  return (
    <div className="space-y-6">
      <Link href="/portal/jobs" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm [&_svg]:size-4">
        <ArrowLeft />
        Back to jobs
      </Link>
      <PortalJobTimeline job={job} attachments={attachments} />
    </div>
  );
}
