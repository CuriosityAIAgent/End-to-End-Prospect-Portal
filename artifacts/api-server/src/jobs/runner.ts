// ============================================================================
// Background job runner — lean, in-process, Postgres-backed.
//
// No Redis / no separate worker service (we stay on Railway single-service).
// State lives in the `jobs` table so the UI can poll progress, the banker can
// leave and come back, and a restart can't leave a job spinning forever.
// ============================================================================

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, jobsTable, type Job } from "@workspace/db";
import { logger } from "../lib/logger";
import { ACTIVE_STATUSES, isOrphan } from "./orphan";

export type JobStatus =
  | "queued"
  | "researching"
  | "drafting"
  | "estimating"
  | "verifying"
  | "done"
  | "failed";

export function isTerminal(status: string): boolean {
  return status === "done" || status === "failed";
}

// ── In-process liveness registry ────────────────────────────────────────────
// The single-instance worker tracks the job ids it is actually running (or about
// to run). An ACTIVE job in the DB whose id is NOT here belongs to a previous
// (crashed/redeployed) process — a dead orphan. This is the exact signal that
// boot recovery approximates; using it directly means we never misjudge a
// slow-but-live run and we reclaim orphans no matter which stage they died in.
const liveJobIds = new Set<string>();
function trackJob(id: string): void {
  liveJobIds.add(id);
}
function untrackJob(id: string): void {
  liveJobIds.delete(id);
}

/** Client-safe view of a job (drops internal timestamps we don't surface). */
export function serializeJob(job: Job) {
  return {
    id: job.id,
    kind: job.kind,
    prospectId: job.prospectId,
    status: job.status,
    progress: job.progress,
    stageDetail: job.stageDetail ?? null,
    partial: job.partial ?? null,
    result: job.result ?? null,
    error: job.error ?? null,
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
  };
}

export async function createJob(kind: string, prospectId: number): Promise<Job> {
  const [row] = await db
    .insert(jobsTable)
    .values({ kind, prospectId, status: "queued", progress: 0 })
    .returning();
  return row;
}

/**
 * Atomically enqueue at most one ACTIVE job per (prospect, kind). A transaction-
 * scoped Postgres advisory lock keyed on (kind, prospect) serialises concurrent
 * enqueues for the same prospect, so the "is there an active job?" check and the
 * insert can't race — without relying on a DB index/constraint. Returns the
 * existing active job (created=false) or the newly created one (created=true).
 */
export async function enqueueUniqueJob(
  kind: string,
  prospectId: number,
): Promise<{ job: Job; created: boolean }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${kind}:${prospectId}`}))`);
    const [existing] = await tx
      .select()
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.kind, kind),
          eq(jobsTable.prospectId, prospectId),
          inArray(jobsTable.status, [...ACTIVE_STATUSES]),
        ),
      )
      .orderBy(desc(jobsTable.createdAt))
      .limit(1);
    if (existing && liveJobIds.has(existing.id)) return { job: existing, created: false };
    if (existing) {
      // Active in the DB but NOT live in this process → orphaned by a dead prior
      // process. Fail it inside this lock, then fall through to start a fresh run
      // so the prospect is never permanently blocked by a wedged job.
      await tx
        .update(jobsTable)
        .set({ status: "failed", error: "interrupted (orphan — reclaimed on re-run)" })
        .where(eq(jobsTable.id, existing.id));
      untrackJob(existing.id);
      logger.warn({ id: existing.id, prospectId }, "Reclaimed an orphaned job on enqueue");
    }
    const [row] = await tx
      .insert(jobsTable)
      .values({ kind, prospectId, status: "queued", progress: 0 })
      .returning();
    // Track immediately on creation (before the caller schedules it) so a
    // concurrent reattach can't briefly mistake this fresh job for an orphan.
    trackJob(row.id);
    return { job: row, created: true };
  });
}

/** The most recent non-terminal job for (kind, prospect) — used for idempotency
 * (a double-click shouldn't start two runs) and for page-load reattachment. */
export async function findActiveJob(kind: string, prospectId: number): Promise<Job | undefined> {
  const [row] = await db
    .select()
    .from(jobsTable)
    .where(
      and(
        eq(jobsTable.kind, kind),
        eq(jobsTable.prospectId, prospectId),
        inArray(jobsTable.status, [...ACTIVE_STATUSES]),
      ),
    )
    .orderBy(desc(jobsTable.createdAt))
    .limit(1);
  // Don't reattach the UI to an orphaned (dead-process) job — it would poll a run
  // nothing will finish. A subsequent enqueue reclaims it.
  if (row && isOrphan(row, liveJobIds)) return undefined;
  return row;
}

/** If a job is an orphan (active in the DB but not live in this process), mark it
 * failed and return the failed view; otherwise return it unchanged. Used on the
 * reattach path so the UI sees "failed" (and can retry) instead of polling a dead
 * run forever. */
export async function reclaimIfOrphan(job: Job): Promise<Job> {
  if (!isOrphan(job, liveJobIds)) return job;
  const error = "interrupted (orphan — reclaimed)";
  await db.update(jobsTable).set({ status: "failed", error }).where(eq(jobsTable.id, job.id));
  untrackJob(job.id);
  logger.warn({ id: job.id, prospectId: job.prospectId }, "Reclaimed an orphaned job");
  return { ...job, status: "failed", error };
}

export async function latestJob(kind: string, prospectId: number): Promise<Job | undefined> {
  const [row] = await db
    .select()
    .from(jobsTable)
    .where(and(eq(jobsTable.kind, kind), eq(jobsTable.prospectId, prospectId)))
    .orderBy(desc(jobsTable.createdAt))
    .limit(1);
  return row;
}

export async function getJob(id: string): Promise<Job | undefined> {
  const [row] = await db.select().from(jobsTable).where(eq(jobsTable.id, id)).limit(1);
  return row;
}

/** Patch a job and bump its heartbeat (the liveness signal). */
export async function updateJob(
  id: string,
  patch: Partial<typeof jobsTable.$inferInsert>,
): Promise<void> {
  await db
    .update(jobsTable)
    .set({ ...patch, heartbeatAt: new Date() })
    .where(eq(jobsTable.id, id));
}

// ── In-process concurrency cap ──────────────────────────────────────────────
// Research fan-out is network-bound, so a couple in parallel is fine; unbounded
// would exhaust outbound rate limits. Jobs beyond the cap wait for a free slot.
const MAX_CONCURRENT = Number(process.env.JOB_CONCURRENCY) || 2;
let running = 0;
const waiters: Array<() => void> = [];

function acquire(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => waiters.push(resolve));
}

function release(): void {
  const next = waiters.shift();
  if (next) {
    next(); // hand the slot straight to the next waiter (running stays the same)
    return;
  }
  running -= 1;
}

/** Run a job task in the background, respecting the concurrency cap. Pass the
 * job id so the in-process liveness registry is cleared when the task ends (so a
 * finished/failed job is no longer treated as live). */
export function schedule(task: () => Promise<void>, jobId?: string): void {
  void acquire().then(async () => {
    try {
      await task();
    } catch (err) {
      logger.error({ err }, "Background job task threw");
    } finally {
      release();
      if (jobId) untrackJob(jobId);
    }
  });
}

/**
 * Boot-time recovery. The worker runs in-process on a single instance, so when
 * this process starts, ANY job still in an active state belongs to a previous
 * (crashed/redeployed) process — there is no other worker that could be running
 * it, regardless of how recently it heartbeated. Mark them all failed so the UI
 * stops polling a job nothing will finish and offers a retry.
 *
 * MUST be awaited BEFORE the HTTP listener opens (see index.ts): once we accept
 * requests, new jobs exist that we must not sweep. Fail-soft if the DB isn't
 * provisioned (matches the lazy-connection philosophy).
 */
export async function recoverStaleJobs(): Promise<void> {
  try {
    const recovered = await db
      .update(jobsTable)
      .set({ status: "failed", error: "interrupted", heartbeatAt: new Date() })
      .where(inArray(jobsTable.status, [...ACTIVE_STATUSES]))
      .returning({ id: jobsTable.id });
    if (recovered.length) {
      logger.warn({ count: recovered.length }, "Recovered orphaned jobs after restart");
    }
  } catch (err) {
    logger.warn({ err }, "Job recovery sweep skipped (DB unavailable?)");
  }
}
