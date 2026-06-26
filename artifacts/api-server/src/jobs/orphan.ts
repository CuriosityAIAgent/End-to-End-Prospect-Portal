// ============================================================================
// Orphan detection — pure, DB-free, unit-testable.
//
// The worker is single-instance and in-process, so THIS process is the only
// authority on what's truly running. A job that is ACTIVE in the DB but is NOT
// tracked as live by this process was started by a previous (crashed/redeployed)
// process — a dead orphan we can safely reclaim. This is exact: no heartbeat
// timing heuristic, so it never false-positives a slow-but-live run, and it
// reclaims orphans regardless of which stage (queued included) they died in.
// ============================================================================

export const ACTIVE_STATUSES = [
  "queued",
  "researching",
  "drafting",
  "estimating",
  "verifying",
] as const;

export function isActiveStatus(status: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

/** An active job not tracked as live by this process = orphaned by a dead one. */
export function isOrphan(
  job: { id: string; status: string },
  liveIds: ReadonlySet<string>,
): boolean {
  return isActiveStatus(job.status) && !liveIds.has(job.id);
}
