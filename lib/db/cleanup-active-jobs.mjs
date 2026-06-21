// Pre-migrate cleanup: fail any jobs left ACTIVE by a previous process.
//
// The worker is single-instance, so at deploy time every active job is an
// orphan. We must clear them BEFORE `drizzle-kit push` runs, otherwise creating
// the partial unique index on (prospect_id, kind) over active statuses would
// fail if two orphaned active rows share a prospect — which would block startup.
// Runs inside @workspace/db so `pg` resolves; no-ops if the table doesn't exist
// yet (first deploy) or DATABASE_URL is unset.

import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[predeploy] DATABASE_URL not set — skipping jobs cleanup");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const res = await pool.query(
    `UPDATE jobs SET status = 'failed', error = 'interrupted'
     WHERE status IN ('queued','researching','drafting','estimating','verifying')`,
  );
  console.log(`[predeploy] cleared ${res.rowCount ?? 0} active job(s) before migrate`);
} catch (err) {
  // Table may not exist yet (first deploy) — that's fine.
  console.log("[predeploy] jobs cleanup skipped:", err?.message ?? err);
} finally {
  await pool.end();
}
