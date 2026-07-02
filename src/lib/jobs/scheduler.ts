import type { JobScheduler } from "@/lib/jobs/types";

/**
 * In-memory scheduler — the zero-cost default (Phase 6, §15.13).
 *
 * Holds interval registrations and answers "which jobs are due now," without a
 * running clock. Phase 6A ships this so time-based work has a home; the cron
 * runner that actually ticks (Vercel Cron or equivalent) is the §15.13 funding
 * trigger. When it lands, the runner is a thin loop — `due(now)` → `enqueue()`
 * → `markRan()` — and this abstraction is unchanged.
 *
 * Until then, time-based automation continues to fire lazily on read exactly as
 * Phase 5's overdue detection already does (§15.7) — this scheduler does not
 * change that behavior; it makes the proactive path a drop-in when funded.
 */
export class InMemoryJobScheduler implements JobScheduler {
  private readonly intervals = new Map<string, number>();
  private readonly lastRun = new Map<string, number>();

  schedule(name: string, intervalMs: number): void {
    this.intervals.set(name, intervalMs);
  }

  due(now: number = Date.now()): string[] {
    const result: string[] = [];
    for (const [name, intervalMs] of this.intervals) {
      const last = this.lastRun.get(name);
      if (last === undefined || now - last >= intervalMs) {
        result.push(name);
      }
    }
    return result;
  }

  markRan(name: string, now: number = Date.now()): void {
    this.lastRun.set(name, now);
  }

  /** Test helper — drop all registrations and history. */
  clear(): void {
    this.intervals.clear();
    this.lastRun.clear();
  }
}
