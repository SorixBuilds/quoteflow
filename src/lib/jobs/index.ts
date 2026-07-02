import { providerRegistry } from "@/lib/providers/registry";
import { InMemoryJobQueue } from "@/lib/jobs/in-memory-queue";
import { InMemoryJobScheduler } from "@/lib/jobs/scheduler";
import type { JobQueue } from "@/lib/jobs/types";

/**
 * Background job foundation — singletons + resolver (Phase 6, §6).
 *
 * Process-wide queue and scheduler singletons (the `lib/db.ts` discipline), plus
 * a `resolveJobQueue()` that goes through the provider registry so a durable
 * queue can be injected later (or in tests) without touching consumers. There is
 * no env-driven branch yet because there is only one implementation; the seam is
 * the registry override, ready for the durable queue when it lands.
 */
const JOB_QUEUE_KEY = "job-queue";

export const jobQueue = new InMemoryJobQueue();
export const jobScheduler = new InMemoryJobScheduler();

/** Resolve the active job queue (registry-injectable; defaults to the singleton). */
export function resolveJobQueue(): JobQueue {
  return providerRegistry.resolve<JobQueue>(JOB_QUEUE_KEY, () => jobQueue);
}

export { JOB_QUEUE_KEY };
export { InMemoryJobQueue } from "@/lib/jobs/in-memory-queue";
export { InMemoryJobScheduler } from "@/lib/jobs/scheduler";
export {
  DEFAULT_RETRY_POLICY,
  computeBackoffMs,
  shouldRetry,
} from "@/lib/jobs/retry";
export type {
  JobDefinition,
  JobQueue,
  JobScheduler,
  JobContext,
  QueuedJob,
  RetryPolicy,
  ProcessSummary,
  JobStatus,
} from "@/lib/jobs/types";
