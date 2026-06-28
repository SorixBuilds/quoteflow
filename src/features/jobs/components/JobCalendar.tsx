import Link from "next/link";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import type { JobStatus } from "@prisma/client";

/**
 * Job calendar (Phase 5, §20). A simple month grid grouping scheduled jobs by
 * day — reuses the same `getJobsForCalendar` query (date-range filter) rather
 * than a new data-fetching mechanism. Month navigation is URL-driven so the view
 * stays server-rendered.
 */

export type CalendarJob = {
  id: string;
  customerName: string;
  status: JobStatus;
  scheduledDate: Date;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function JobCalendar({
  year,
  month, // 0-indexed
  jobs,
}: {
  year: number;
  month: number;
  jobs: CalendarJob[];
}) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Group jobs by day-of-month.
  const byDay = new Map<number, CalendarJob[]>();
  for (const job of jobs) {
    const day = job.scheduledDate.getDate();
    const list = byDay.get(day) ?? [];
    list.push(job);
    byDay.set(day, list);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{monthLabel(year, month)}</h2>
        <div className="flex gap-2">
          <Link
            href={`/jobs/calendar?month=${prevMonth.y}-${pad(prevMonth.m + 1)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Previous
          </Link>
          <Link
            href={`/jobs/calendar?month=${nextMonth.y}-${pad(nextMonth.m + 1)}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Next
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
        {WEEKDAYS.map((wd) => (
          <div key={wd} className="bg-muted/50 text-muted-foreground px-2 py-1.5 text-center text-xs font-medium">
            {wd}
          </div>
        ))}
        {cells.map((day, i) => (
          <div key={i} className="bg-card min-h-24 p-1.5 align-top">
            {day ? (
              <>
                <div className="text-muted-foreground mb-1 text-xs">{day}</div>
                <ul className="space-y-1">
                  {(byDay.get(day) ?? []).map((job) => (
                    <li key={job.id}>
                      <Link
                        href={`/jobs/${job.id}`}
                        className="hover:bg-accent block rounded px-1 py-0.5 text-xs"
                        title={job.customerName}
                      >
                        <StatusBadge status={job.status} variant="job" className="mr-1 px-1 py-0" />
                        <span className="truncate">{job.customerName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
