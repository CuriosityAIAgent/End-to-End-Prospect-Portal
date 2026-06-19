// ============================================================================
// Background job runner — lean, in-process, Postgres-backed.
//
// No Redis / no separate worker service (we stay on Railway single-service).
// State lives in the `jobs` table so the UI can poll progress, the banker can
// leave and come back, and a restart can't leave a job spinning forever.
// ============================================================================

import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db, jobsTable, type Job } from "@workspace/db";
import { logger } from "../lib/logger";

export type JobStatus =
  | "queued"
  | "researching"
  | "drafting"
  | "verifying"
  | "done"
  | "failed";

const ACTIVE_STATUSES: JobStatus[] = ["queued", "researching", "drafting", "verifying"];

export function isTerminal(status: string): boolean {
  return status === "done" || status === "failed";
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
        inArray(jobsTable.status, ACTIVE_STATUSES),
      ),
    )
    .orderBy(desc(jobsTable.createdAt))
    .limit(1);
  return row;
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

/** Run a job task in the background, respecting the concurrency cap. */
export function schedule(task: () => Promise<void>): void {
  void acquire().then(async () => {
    try {
      await task();
    } catch (err) {
      logger.error({ err }, "Background job task threw");
    } finally {
      release();
    }
  });
}

/**
 * Boot-time recovery: any job still ACTIVE belongs to a previous process (this
 * one has just started and created none yet), so mark them failed/interrupted
 * rather than let the UI poll a job nothing is working on. Fail-soft if the DB
 * isn't provisioned (matches the lazy-connection philosophy).
 */
export async function recoverStaleJobs(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 90_000);
    const recovered = await db
      .update(jobsTable)
      .set({ status: "failed", error: "interrupted", heartbeatAt: new Date() })
      .where(
        and(
          inArray(jobsTable.status, ACTIVE_STATUSES),
          or(lt(jobsTable.heartbeatAt, cutoff), isNull(jobsTable.heartbeatAt)),
        ),
      )
      .returning({ id: jobsTable.id });
    if (recovered.length) {
      logger.warn({ count: recovered.length }, "Recovered stale jobs after restart");
    }
  } catch (err) {
    logger.warn({ err }, "Job recovery sweep skipped (DB unavailable?)");
  }
}
