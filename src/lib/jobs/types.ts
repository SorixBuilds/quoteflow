/**
 * Background job foundation — contracts (Phase 6, §6, §15.13, §21.7).
 *
 * The infrastructure later milestones use for deferred/retried work: email
 * delivery retry (§11.10), webhook delivery + backoff (§21.7), and the
 * time-based automation sweep once a cron runner is funded (§15.13). Phase 6A
 * ships the abstractions and an in-memory default queue/scheduler; **no
 * production job is registered yet** (authorization brief: "No production jobs
 * need to exist yet. Only the infrastructure.").
 *
 * The interfaces are deliberately provider-shaped (§6.1): the in-memory queue is
 * the zero-cost default, and a future durable queue (a DB-backed table such as
 * `WebhookDelivery`, or an external queue) is a drop-in implementation of the
 * same `JobQueue` interface — no consumer changes.
 */

/** A retry policy. Pure data so it is trivially testable and serializable. */
export interface RetryPolicy {
  /** Total attempts including the first (>= 1). */
  maxAttempts: number;
  /** Delay before the first retry. */
  baseDelayMs: number;
  /** Upper bound on any single backoff delay. */
  maxDelayMs: number;
}

/** Context passed to a handler on each attempt. */
export interface JobContext {
  /** 1-based attempt number. */
  attempt: number;
}

/** A registered job type: a name, a handler, and an optional retry policy. */
export interface JobDefinition<TPayload = unknown> {
  name: string;
  handler: (payload: TPayload, ctx: JobContext) => Promise<void> | void;
  /** Defaults to `DEFAULT_RETRY_POLICY` when omitted. */
  retry?: RetryPolicy;
}

export type JobStatus = "pending" | "completed" | "failed";

/** A queued unit of work. */
export interface QueuedJob<TPayload = unknown> {
  id: string;
  name: string;
  payload: TPayload;
  status: JobStatus;
  attempts: number;
  /** Earliest time (ms epoch) this job may next run — drives retry backoff. */
  nextRunAt: number;
  lastError?: string;
}

/** The outcome of draining the queue once. */
export interface ProcessSummary {
  ran: number;
  completed: number;
  failed: number;
  retried: number;
}

/**
 * The queue abstraction. The in-memory default implements it for Phase 6A; a
 * durable queue implements the same shape later.
 */
export interface JobQueue {
  register<TPayload>(definition: JobDefinition<TPayload>): void;
  enqueue<TPayload>(name: string, payload: TPayload): Promise<string>;
  /** Run every due, pending job once, applying retry policy. */
  process(now?: number): Promise<ProcessSummary>;
}

/**
 * The scheduler abstraction (time-based triggers). Phase 6A registers intervals
 * and answers "what is due now" without a running clock — the §15.13 cron runner
 * that actually ticks is deferred. A future runner simply calls `due()` then
 * `enqueue()`; the abstraction does not change.
 */
export interface JobScheduler {
  /** Register a job name to run no more often than `intervalMs`. */
  schedule(name: string, intervalMs: number): void;
  /** Names whose interval has elapsed since their last run, given `now`. */
  due(now?: number): string[];
  /** Record that a scheduled job ran at `now` (resets its interval). */
  markRan(name: string, now?: number): void;
}
