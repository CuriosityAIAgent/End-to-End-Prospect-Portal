/**
 * Align every existing prospect to the current "Samir standard": re-run the prep
 * pipeline through the latest prompts so each profile shows the same workflow,
 * structure and content quality (banker-attributed emails + call, preserved
 * numbers, the watch-item exact-name fix, etc.).
 *
 * It drives the DEPLOYED API (so it reuses the server's keys + the live pipeline
 * code — this script needs no DB or AI keys itself). With `force` it bypasses the
 * cached research corpus so research-query changes (the watch-item fix) land too.
 *
 * Usage:
 *   ALIGN_BASE_URL=https://<deployed-app> pnpm --filter @workspace/scripts run align-profiles            # dry run (lists what it would do)
 *   ALIGN_BASE_URL=https://<deployed-app> pnpm --filter @workspace/scripts run align-profiles -- --apply  # actually re-generate
 * Flags:
 *   --apply        perform the re-generation (default: dry run)
 *   --no-force     reuse cached research instead of refreshing it
 *   --base=URL     base URL (overrides ALIGN_BASE_URL)
 *   --depth=quick  shallow re-gen (default: deep)
 */

type Prospect = { id: number; name: string; hasPrep: boolean; relationshipManager: string | null };
type Job = { status?: string; progress?: number; error?: string } | null;

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const valOf = (p: string) => args.find((a) => a.startsWith(p))?.slice(p.length);

const base = (valOf("--base=") ?? process.env.ALIGN_BASE_URL ?? "").replace(/\/$/, "");
const apply = has("--apply");
const force = !has("--no-force");
const depth = valOf("--depth=") === "quick" ? "quick" : "deep";

const PER_PROFILE_TIMEOUT_MS = 6 * 60_000;
const POLL_EVERY_MS = 5_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const REQUEST_TIMEOUT_MS = 30_000;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // Every request is bounded so a stalled TCP/TLS connection can't hang the
  // whole batch — the per-profile deadline relies on each fetch returning.
  const res = await fetch(`${base}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function regenerate(p: Prospect): Promise<"done" | "failed" | "timeout" | "skipped"> {
  const { jobId, created } = await api<{ jobId: string; created: boolean }>(
    `/api/prospects/${p.id}/prep`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depth, force }),
    },
  );
  if (!created) {
    // A prep job was already running for this profile; our forced run did NOT
    // start. Don't claim alignment — skip and let the operator re-run once the
    // existing job has finished.
    return "skipped";
  }
  const deadline = Date.now() + PER_PROFILE_TIMEOUT_MS;
  let pollErrors = 0;
  while (Date.now() < deadline) {
    await sleep(POLL_EVERY_MS);
    let job: Job;
    try {
      // Poll the SPECIFIC job we started, not "latest for this prospect", so a
      // concurrent retry can't make us report the wrong run's outcome.
      job = await api<Job>(`/api/jobs/${jobId}`);
      pollErrors = 0;
    } catch (err) {
      // Don't silently treat poll failures as "pending" — a persistent
      // 401/404/5xx is a real failure the operator needs to see.
      if (++pollErrors >= 3) {
        console.log(`    poll failed: ${err instanceof Error ? err.message : String(err)}`);
        return "failed";
      }
      continue;
    }
    const status = job?.status;
    if (status === "done") return "done";
    if (status === "failed") {
      console.log(`    job failed: ${job?.error ?? "unknown"}`);
      return "failed";
    }
    process.stdout.write(`    …${status ?? "pending"} ${job?.progress ?? 0}%\r`);
  }
  return "timeout";
}

async function main() {
  if (!base) {
    console.error("Set ALIGN_BASE_URL (or pass --base=https://…) to the deployed app.");
    process.exit(1);
  }
  console.log(`Base: ${base}`);
  console.log(`Mode: ${apply ? "APPLY (re-generating)" : "DRY RUN (no changes)"} | force-research: ${force} | depth: ${depth}\n`);

  const prospects = await api<Prospect[]>("/api/prospects");
  console.log(`${prospects.length} profile(s) found:\n`);
  for (const p of prospects) {
    const banker = p.relationshipManager ? `banker: ${p.relationshipManager}` : "NO BANKER SET";
    console.log(`  #${p.id} ${p.name} — ${p.hasPrep ? "has prep" : "no prep"}, ${banker}`);
  }

  if (!apply) {
    console.log(`\nDry run — would re-generate all ${prospects.length} profile(s). Re-run with --apply to do it.`);
    const noBanker = prospects.filter((p) => !p.relationshipManager?.trim());
    if (noBanker.length) {
      console.log(`\nNote: ${noBanker.length} profile(s) have no banker set — their emails/call won't be attributed until one is added:`);
      noBanker.forEach((p) => console.log(`  - #${p.id} ${p.name}`));
    }
    return;
  }

  const LABEL = {
    done: "✓ regenerated",
    failed: "✗ failed",
    timeout: "⌛ timed out (still running server-side)",
    skipped: "↷ skipped — a prep job was already running; re-run later",
  } as const;
  let done = 0, failed = 0, timeout = 0, skipped = 0;
  for (const p of prospects) {
    console.log(`\n→ #${p.id} ${p.name}`);
    try {
      const outcome = await regenerate(p);
      console.log(`    ${LABEL[outcome]}`);
      if (outcome === "done") done++;
      else if (outcome === "failed") failed++;
      else if (outcome === "skipped") skipped++;
      else timeout++;
    } catch (err) {
      failed++;
      console.log(`    ✗ error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\nDone. regenerated=${done} failed=${failed} timeout=${timeout} skipped=${skipped} of ${prospects.length}.`);
  if (skipped) console.log("Re-run to align the skipped profiles once their in-flight jobs finish.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
