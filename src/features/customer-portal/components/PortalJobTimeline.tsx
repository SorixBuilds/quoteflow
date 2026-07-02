import { CheckCircle2, Circle, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { AttachmentView } from "@/features/files/queries";
import type { PortalJobDetail } from "@/features/customer-portal/queries";
import { PortalFileList } from "@/features/customer-portal/components/PortalFileList";

/**
 * Customer-facing job tracking (§12.5) — status + schedule + completion notes,
 * strictly read-only. The "timeline" is derived from the job's own frozen fields
 * (scheduled → in progress → completed); it deliberately does NOT surface the
 * internal Activity log, which carries staff attribution and internal notes
 * (§12.8). No management control is exposed (§5).
 */
export function PortalJobTimeline({
  job,
  attachments,
}: {
  job: PortalJobDetail;
  attachments: AttachmentView[];
}) {
  const completed = job.status === "COMPLETED";
  const inProgress = job.status === "IN_PROGRESS";
  const cancelled = job.status === "CANCELLED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground text-xl font-semibold">Job {job.reference}</h1>
          {job.technicianName ? (
            <p className="text-muted-foreground mt-1 text-sm">Technician: {job.technicianName}</p>
          ) : null}
        </div>
        <StatusBadge status={job.status} variant="job" />
      </div>

      {cancelled ? (
        <p className="text-muted-foreground text-sm">This job has been cancelled.</p>
      ) : (
        <ol className="space-y-4">
          <Milestone
            icon={CheckCircle2}
            done
            title="Scheduled"
            detail={job.scheduledDate ? job.scheduledDate.toLocaleDateString() : "To be confirmed"}
          />
          <Milestone
            icon={inProgress || completed ? CheckCircle2 : Clock}
            done={inProgress || completed}
            title="In progress"
            detail={inProgress ? "Work underway" : completed ? "Completed" : "Not started yet"}
          />
          <Milestone
            icon={completed ? CheckCircle2 : Circle}
            done={completed}
            title="Completed"
            detail={
              completed && job.completedAt ? job.completedAt.toLocaleDateString() : "Pending"
            }
          />
        </ol>
      )}

      {job.notes ? (
        <div className="space-y-1">
          <h2 className="text-foreground text-sm font-semibold">Notes</h2>
          <p className="text-muted-foreground text-sm whitespace-pre-wrap">{job.notes}</p>
        </div>
      ) : null}

      <PortalFileList attachments={attachments} />
    </div>
  );
}

function Milestone({
  icon: Icon,
  done,
  title,
  detail,
}: {
  icon: typeof Circle;
  done: boolean;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <Icon className={cn("mt-0.5 size-5 shrink-0", done ? "text-green-600" : "text-muted-foreground")} />
      <div>
        <p className="text-foreground text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{detail}</p>
      </div>
    </li>
  );
}
