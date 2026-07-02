import { logger } from "@/lib/logger";
import {
  DEFAULT_RETRY_POLICY,
  computeBackoffMs,
  shouldRetry,
} from "@/lib/jobs/retry";
import type {
  JobDefinition,
  JobQueue,
  ProcessSummary,
  QueuedJob,
} from "@/lib/jobs/types";

/**
 * In-memory job queue — the zero-cost default (Phase 6, §6).
 *
 * Implements the full `JobQueue` contract — register, enqueue, drain with retry,
 * failure handling, structured logging — against an in-process array. It is the
 * foundation later milestones build on; Phase 6A registers no production jobs.
 *
 * Documented limitation (the same one the frozen login limiter and §11.10/§21.7
 * already accept): state lives in this process, so a job does not survive a
 * restart and is not shared across serverless instances. The upgrade path is a
 * durable `JobQueue` (a DB-backed table such as `WebhookDelivery`, or an external
 * queue) implementing this same interface — no consumer changes (§6.1).
 *
 * `process()` is time-injectable (`now`) and does not sleep: a job whose backoff
 * has not elapsed is simply skipped until a later `process()` call, so the queue
 * is driven by an external tick (a request, a test, or a future cron) rather than
 * holding the event loop. This mirrors the §15.7 "fires lazily on read" posture.
 */
export class InMemoryJobQueue implements JobQueue {
  private readonly definitions = new Map<string, JobDefinition>();
  private readonly jobs: QueuedJob[] = [];
  private idCounter = 0;

  register<TPayload>(definition: JobDefinition<TPayload>): void {
    this.definitions.set(definition.name, definition as JobDefinition);
  }

  async enqueue<TPayload>(name: string, payload: TPayload): Promise<string> {
    if (!this.definitions.has(name)) {
      throw new Error(`No job registered for "${name}".`);
    }
    const id = `job_${(this.idCounter += 1)}`;
    this.jobs.push({
      id,
      name,
      payload,
      status: "pending",
      attempts: 0,
      nextRunAt: 0, // runnable immediately
    });
    return id;
  }

  async process(now: number = Date.now()): Promise<ProcessSummary> {
    const summary: ProcessSummary = {
      ran: 0,
      completed: 0,
      failed: 0,
      retried: 0,
    };

    for (const job of this.jobs) {
      if (job.status !== "pending" || job.nextRunAt > now) continue;

      const definition = this.definitions.get(job.name);
      if (!definition) {
        job.status = "failed";
        job.lastError = `No job registered for "${job.name}".`;
        summary.failed += 1;
        continue;
      }

      const policy = definition.retry ?? DEFAULT_RETRY_POLICY;
      job.attempts += 1;
      summary.ran += 1;

      try {
        await definition.handler(job.payload, { attempt: job.attempts });
        job.status = "completed";
        job.lastError = undefined;
        summary.completed += 1;
        logger.info("Job completed", { id: job.id, name: job.name, attempt: job.attempts });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        job.lastError = message;
        if (shouldRetry(job.attempts, policy)) {
          job.status = "pending";
          job.nextRunAt = now + computeBackoffMs(job.attempts + 1, policy);
          summary.retried += 1;
          logger.warn("Job failed; scheduled for retry", {
            id: job.id,
            name: job.name,
            attempt: job.attempts,
            nextRunAt: job.nextRunAt,
            error: message,
          });
        } else {
          job.status = "failed";
          summary.failed += 1;
          logger.error("Job failed permanently (retries exhausted)", {
            id: job.id,
            name: job.name,
            attempt: job.attempts,
            error: message,
          });
        }
      }
    }

    return summary;
  }

  /** Inspect a job by id (tests/observability). */
  get(id: string): QueuedJob | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  /** Snapshot of all jobs (tests/observability). */
  list(): readonly QueuedJob[] {
    return this.jobs;
  }

  /** Test helper — drop all jobs and registrations. */
  clear(): void {
    this.jobs.length = 0;
    this.definitions.clear();
    this.idCounter = 0;
  }
}
