import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch, getGetProspectQueryKey } from "@workspace/api-client-react";
import type { PrepPack } from "@workspace/research-pipeline/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sparkles, Loader2, AlertCircle, ShieldCheck, ShieldAlert,
  Phone, ScrollText, Compass, ExternalLink, FileText, Check, Gauge, Layers,
} from "lucide-react";

type ResearchDepth = "quick" | "deep";

type JobStatus = "queued" | "researching" | "drafting" | "estimating" | "verifying" | "done" | "failed";

interface JobView {
  id: string;
  status: JobStatus;
  progress: number;
  stageDetail: string | null;
  partial: PrepPack | null;
  result: PrepPack | null;
  error: string | null;
  startedAt: string | null;
}

const isTerminal = (s: JobStatus | undefined): boolean => s === "done" || s === "failed";

// Ordered stages for the progress strip; index used to mark done / active / pending.
const STAGES: { key: JobStatus; label: string }[] = [
  { key: "researching", label: "Searching sources" },
  { key: "drafting", label: "Drafting the read" },
  { key: "estimating", label: "Estimating net worth" },
  { key: "verifying", label: "Verifying claims" },
];
const STAGE_INDEX: Record<JobStatus, number> = {
  queued: 0, researching: 0, drafting: 1, estimating: 2, verifying: 3, done: 4, failed: 0,
};

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ── prospect-portal-ke editorial design tokens ──────────────────────────────
// Editorial private-bank register matching the deployed JPC portal: white
// ground, near-black ink, teal-green accent (eyebrow rules, affordances), soft
// 1px borders, serif display. No gradients, no shadows.
const PAPER = "#FFFFFF";
const INK = "#1A1A1A";
const ACCENT = "#0E9C77"; // teal-green accent (matches the JPC portal screenshot)
const BORDER = "#E6E4DE";
const SERIF = "'Source Serif 4', Georgia, 'Times New Roman', serif";

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: ACCENT }}
      >
        {children}
      </span>
      <span className="block h-px w-10" style={{ background: ACCENT }} />
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[22px] leading-tight font-normal" style={{ fontFamily: SERIF, color: INK }}>
      {children}
    </h3>
  );
}

const CONFIDENCE: Record<
  NonNullable<PrepPack["verification"]>["overallConfidence"],
  { className: string; icon: typeof ShieldCheck; label: string }
> = {
  high: { className: "bg-emerald-50 border-emerald-200 text-emerald-900", icon: ShieldCheck, label: "High confidence — claims trace to the researched sources." },
  medium: { className: "bg-amber-50 border-amber-200 text-amber-900", icon: ShieldAlert, label: "Medium confidence — validate the flagged points with the client." },
  low: { className: "bg-red-50 border-red-200 text-red-900", icon: ShieldAlert, label: "Low confidence — several points could not be corroborated." },
};

// ── Net-worth estimate ──────────────────────────────────────────────────────
function fmtMoney(n: number, currency: string): string {
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sym}${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}bn`;
  if (abs >= 1_000_000) return `${sym}${Math.round(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${sym}${Math.round(n / 1_000)}k`;
  return `${sym}${Math.round(n)}`;
}
function fmtRange(r: { low: number; high: number; currency: string }): string {
  return `${fmtMoney(r.low, r.currency)} – ${fmtMoney(r.high, r.currency)}`;
}

const EST_CONFIDENCE: Record<"high" | "medium" | "low", { className: string; label: string }> = {
  high: { className: "bg-emerald-50 border-emerald-200 text-emerald-800", label: "High confidence" },
  medium: { className: "bg-amber-50 border-amber-200 text-amber-800", label: "Medium confidence" },
  low: { className: "bg-red-50 border-red-200 text-red-800", label: "Low confidence" },
};

const BASIS_STYLE: Record<string, { label: string; className: string }> = {
  "from-source": { label: "from source", className: "border-emerald-300 text-emerald-700" },
  "benchmark-table": { label: "benchmark", className: "border-sky-300 text-sky-700" },
  "benchmark-inferred": { label: "inferred", className: "border-amber-300 text-amber-700" },
  assumption: { label: "assumption", className: "border-stone-300 text-stone-600" },
};

function WealthEstimatePanel({ estimate }: { estimate: NonNullable<PrepPack["wealthEstimate"]> }) {
  if (estimate.refused) {
    return (
      <section className="border rounded p-5" style={{ borderColor: BORDER, background: "#FBFAF7" }}>
        <Eyebrow>Estimated Net Worth</Eyebrow>
        <p className="text-sm mt-3" style={{ color: "#4A4A4A" }}>
          {estimate.refusalReason || "Insufficient public evidence to estimate — confirm career and assets directly with the client."}
        </p>
      </section>
    );
  }
  const conf = EST_CONFIDENCE[estimate.overallConfidence];
  const lineValue = (l: NonNullable<PrepPack["wealthEstimate"]>["assumptions"][number]): string => {
    if (l.annual) return `${fmtRange(l.annual)}/yr × ${l.years ?? "?"}y`;
    if (l.amount) return fmtRange(l.amount);
    if (typeof l.rate === "number") return `${Math.round(l.rate * 100)}%`;
    return "—";
  };
  return (
    <section className="border rounded p-6 space-y-4" style={{ borderColor: BORDER, background: "#FBFAF7" }}>
      <Eyebrow>Estimated Net Worth</Eyebrow>
      <div className="space-y-1">
        <p className="text-[34px] leading-none font-normal" style={{ fontFamily: SERIF, color: INK }}>
          {fmtRange(estimate.totalNetWorth)}
        </p>
        <p className="text-sm" style={{ color: "#4A4A4A" }}>
          Liquid {fmtRange(estimate.liquidNetWorth)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-xs px-2 py-0.5 border rounded ${conf.className}`}>{conf.label}</span>
        {estimate.validation && (
          <span className="text-xs" style={{ color: "#7A7A6F" }}>
            Independently checked by {estimate.validation.validatorModel}
            {estimate.validation.flaggedCount > 0
              ? ` · ${estimate.validation.flaggedCount} assumption${estimate.validation.flaggedCount === 1 ? "" : "s"} to confirm`
              : " · all lines stood up"}
          </span>
        )}
      </div>
      {estimate.headline && (
        <p className="text-[15px] leading-[1.55]" style={{ color: INK }}>{estimate.headline}</p>
      )}
      {estimate.assumptions.length > 0 && (
        <details className="group">
          <summary className="text-xs font-semibold uppercase tracking-[0.14em] cursor-pointer select-none" style={{ color: ACCENT }}>
            How we got there — {estimate.assumptions.length} assumptions
          </summary>
          <ul className="mt-3 space-y-2">
            {estimate.assumptions.map((l) => {
              const bs = BASIS_STYLE[l.basis] ?? BASIS_STYLE.assumption;
              return (
                <li key={l.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm border-t pt-2" style={{ borderColor: BORDER }}>
                  <span style={{ color: INK }}>{l.label}</span>
                  <span className="tabular-nums" style={{ color: "#4A4A4A" }}>{lineValue(l)}</span>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border rounded ${bs.className}`}>{bs.label}</span>
                  {l.validatorNote && (
                    <span className="basis-full text-xs" style={{ color: "#9A7B00" }}>⚑ {l.validatorNote}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs" style={{ color: "#7A7A6F" }}>
            An estimate, not a fact — every line above is an assumption to confirm. The material ones appear as questions below.
          </p>
        </details>
      )}
    </section>
  );
}

export function ProspectPrepPanel({
  prospectId,
  prospectName,
  prep,
  industry,
  knownInfo,
  onFieldChange,
}: {
  prospectId: number;
  prospectName: string;
  prep?: PrepPack;
  industry?: string;
  knownInfo?: string;
  /** Debounced autosave of a single prospect.data field. */
  onFieldChange?: (key: string, value: string) => void;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState<ResearchDepth>("deep");
  const [jobId, setJobId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const generate = useMutation({
    mutationFn: (d: ResearchDepth) =>
      customFetch<{ jobId: string }>(`/api/prospects/${prospectId}/prep`, {
        method: "POST",
        body: JSON.stringify({ depth: d }),
      }),
    onMutate: () => setError(null),
    onSuccess: (res) => setJobId(res.jobId),
    onError: () => setError("The prep pack could not be generated. Please try again."),
  });

  // Poll the background job while it runs; stop once it's terminal.
  const jobQuery = useQuery({
    queryKey: ["prep-job", prospectId, jobId],
    queryFn: () => customFetch<JobView>(`/api/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (q) => (isTerminal(q.state.data?.status) ? false : 1500),
  });
  const job = jobId ? jobQuery.data : undefined;
  const active = !!job && !isTerminal(job.status);

  // Reattach to a run already in progress on load (refresh / navigation).
  useEffect(() => {
    let cancelled = false;
    customFetch<JobView | null>(`/api/prospects/${prospectId}/jobs/latest?kind=prospect_prep`)
      .then((j) => {
        if (!cancelled && j && !isTerminal(j.status)) setJobId(j.id);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [prospectId]);

  // On completion, refresh the prospect so the saved prep loads; surface failures.
  useEffect(() => {
    if (job?.status === "done") {
      qc.invalidateQueries({ queryKey: getGetProspectQueryKey(prospectId) });
    } else if (job?.status === "failed") {
      setError(
        job.error === "interrupted"
          ? "That run was interrupted — please try again."
          : "The prep pack could not be generated. Please try again.",
      );
    }
  }, [job?.status, job?.error, prospectId, qc]);

  // Tick the elapsed timer while a job is active.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  const working = generate.isPending || active;
  const elapsed = job?.startedAt
    ? Math.max(0, Math.floor((now - new Date(job.startedAt).getTime()) / 1000))
    : 0;

  // While a job runs, reveal its partial (the drafted read) before verification
  // finishes; otherwise show the saved prep.
  const shown: PrepPack | undefined = (active ? job?.partial ?? undefined : undefined) ?? prep;

  const flagged = (shown?.verification?.sections ?? []).flatMap((s) =>
    s.claims.filter((c) => c.status === "unsupported").map((c) => ({ ...c, section: s.section })),
  );

  return (
    <div className="border p-8 md:p-10 space-y-8" style={{ background: PAPER, borderColor: BORDER }}>
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-3">
          <Eyebrow>Advisor Prep · Deep Research</Eyebrow>
          <h2 className="text-[30px] leading-[1.1] font-normal" style={{ fontFamily: SERIF, color: INK }}>
            Walk in prepared on {prospectName}.
          </h2>
          <p className="text-sm leading-relaxed max-w-[60ch]" style={{ color: "#4A4A4A" }}>
            A researched read of where the wealth likely sits — across companies, trusts, foundations
            and offshore structures — with a cold-call script and the Source-of-Wealth questions to ask,
            each paired with an anticipated answer to validate with the client. Drafted, independently
            verified, never to be presented as fact unverified.
          </p>
        </div>
      </div>

      {/* What we research from — editable; sharpens the fan-out and grounds the writer. */}
      {onFieldChange && (
        <div className="space-y-4 border-t border-b py-6" style={{ borderColor: BORDER }}>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
              Industry
            </label>
            <input
              type="text"
              value={industry ?? ""}
              onChange={(e) => onFieldChange("industry", e.target.value)}
              placeholder="e.g. Private equity, Technology, Real estate"
              className="w-full text-[15px] px-3 py-2 border rounded outline-none focus:border-current"
              style={{ borderColor: BORDER, color: INK, background: "#FFFFFF" }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
              What you know
            </label>
            <textarea
              value={knownInfo ?? ""}
              onChange={(e) => onFieldChange("knownInfo", e.target.value)}
              placeholder="Their firm, role, where they're based, mutual connections, a recent deal — anything. The more you give, the sharper the research."
              className="w-full min-h-[96px] text-[15px] leading-relaxed px-3 py-2 border rounded outline-none focus:border-current"
              style={{ borderColor: BORDER, color: INK, background: "#FFFFFF" }}
            />
          </div>
        </div>
      )}

      {/* Depth toggle — Quick (fast cold-call read) vs Deep (full registry sweep). */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="inline-flex rounded-md border overflow-hidden" style={{ borderColor: BORDER }}>
          {([
            { key: "deep", icon: Layers, label: "Deep", hint: "Full registry sweep" },
            { key: "quick", icon: Gauge, label: "Quick", hint: "Fast read" },
          ] as const).map((opt) => {
            const on = depth === opt.key;
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                type="button"
                disabled={working}
                onClick={() => setDepth(opt.key)}
                title={opt.hint}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
                )}
                style={on ? { background: ACCENT, color: "#fff" } : { background: "#fff", color: INK }}
              >
                <Icon className="w-3.5 h-3.5" /> {opt.label}
              </button>
            );
          })}
        </div>

        <Button
          onClick={() => generate.mutate(depth)}
          disabled={working}
          className="rounded-md text-white hover:opacity-90"
          style={{ background: ACCENT }}
        >
          {working ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Working…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> {prep ? "Regenerate prep pack" : "Generate prep pack"}</>
          )}
        </Button>
        {prep?.generatedAt && !active && (
          <span className="text-xs" style={{ color: "#7A7A6F" }}>
            Last prepared {new Date(prep.generatedAt).toLocaleString()}
          </span>
        )}
      </div>

      {/* Staged progress — what the banker watches instead of a dead spinner. */}
      {working && (
        <div className="space-y-3 border rounded-md p-4" style={{ borderColor: BORDER, background: "#FBFAF7" }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: INK }}>
              {job?.stageDetail ?? "Starting…"}
            </span>
            <span className="text-xs tabular-nums" style={{ color: "#7A7A6F" }}>{formatElapsed(elapsed)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: BORDER }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.max(5, job?.progress ?? 5)}%`, background: ACCENT }}
            />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {STAGES.map((stage) => {
              const cur = job ? STAGE_INDEX[job.status] : 0;
              const idx = STAGE_INDEX[stage.key];
              const done = cur > idx;
              const isActive = cur === idx;
              return (
                <span key={stage.key} className="inline-flex items-center gap-1.5 text-xs" style={{ color: done || isActive ? INK : "#A8A29A" }}>
                  {done ? (
                    <Check className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                  ) : isActive ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: ACCENT }} />
                  ) : (
                    <span className="w-3.5 h-3.5 inline-flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full" style={{ background: "#D6D1C7" }} /></span>
                  )}
                  {stage.label}
                </span>
              );
            })}
          </div>
          <p className="text-xs" style={{ color: "#7A7A6F" }}>
            You can leave this page — we'll keep working, and you'll find it ready when you return.
          </p>
        </div>
      )}

      {error && !active && (
        <div className="flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {shown && (
        <div className="space-y-10 pt-2">
          {/* Net-worth estimate — the headline read */}
          {shown.wealthEstimate && <WealthEstimatePanel estimate={shown.wealthEstimate} />}

          {/* Verification banner */}
          {shown.verification && (() => {
            const b = CONFIDENCE[shown.verification.overallConfidence];
            const Icon = b.icon;
            return (
              <div className={`flex items-start gap-2.5 border px-3 py-2.5 rounded ${b.className}`}>
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-snug">{b.label}</p>
                  <p className="text-xs opacity-80">
                    Independently checked by {shown.verification.verifierModel}
                    {shown.verification.flaggedCount > 0
                      ? ` · ${shown.verification.flaggedCount} point${shown.verification.flaggedCount === 1 ? "" : "s"} to verify`
                      : " · all points corroborated"}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Market read */}
          {shown.marketRead.trim() && (
            <section className="space-y-3">
              <div className="flex items-center gap-2"><Compass className="w-4 h-4" style={{ color: ACCENT }} /><SectionTitle>Our read</SectionTitle></div>
              <p className="text-[15px] leading-[1.6] whitespace-pre-line" style={{ color: INK }}>{shown.marketRead}</p>
            </section>
          )}

          {/* Cold call */}
          {(shown.coldCall.opener.trim() || shown.coldCall.talkingPoints.length > 0) && (
            <section className="space-y-3">
              <div className="flex items-center gap-2"><Phone className="w-4 h-4" style={{ color: ACCENT }} /><SectionTitle>The approach</SectionTitle></div>
              {shown.coldCall.opener.trim() && (
                <p className="text-[15px] leading-[1.6] italic" style={{ color: INK }}>“{shown.coldCall.opener}”</p>
              )}
              {shown.coldCall.talkingPoints.length > 0 && (
                <ul className="space-y-1.5">
                  {shown.coldCall.talkingPoints.map((t, i) => (
                    <li key={i} className="text-[15px] leading-[1.55] pl-4 relative" style={{ color: INK }}>
                      <span className="absolute left-0" style={{ color: ACCENT }}>—</span>{t}
                    </li>
                  ))}
                </ul>
              )}
              {shown.coldCall.anticipatedObjections.length > 0 && (
                <div className="space-y-2 pt-2">
                  {shown.coldCall.anticipatedObjections.map((o, i) => (
                    <div key={i} className="border-l-2 pl-3" style={{ borderColor: BORDER }}>
                      <p className="text-sm font-medium" style={{ color: INK }}>“{o.objection}”</p>
                      <p className="text-sm" style={{ color: "#4A4A4A" }}>{o.response}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Source of Wealth questions */}
          {shown.sourceOfWealth.questions.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2"><ScrollText className="w-4 h-4" style={{ color: ACCENT }} /><SectionTitle>Source of Wealth — questions to validate</SectionTitle></div>
              {shown.sourceOfWealth.likelyCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {shown.sourceOfWealth.likelyCategories.map((c) => (
                    <span key={c} className="text-[11px] uppercase tracking-wider px-2 py-0.5 border rounded" style={{ borderColor: BORDER, color: ACCENT }}>{c}</span>
                  ))}
                </div>
              )}
              <ol className="space-y-5">
                {shown.sourceOfWealth.questions.map((q, i) => (
                  <li key={i} className="space-y-1.5 border-t pt-4" style={{ borderColor: BORDER }}>
                    <p className="text-[16px] leading-snug font-medium" style={{ color: INK }}>{i + 1}. {q.question}</p>
                    {q.why && <p className="text-xs" style={{ color: "#7A7A6F" }}>Why it matters: {q.why}</p>}
                    {q.suggestedAnswer && (
                      <p className="text-sm leading-relaxed" style={{ color: "#4A4A4A" }}>
                        <span className="font-medium" style={{ color: ACCENT }}>Likely answer (validate): </span>{q.suggestedAnswer}
                      </p>
                    )}
                    {q.expectedEvidence.length > 0 && (
                      <p className="text-xs flex items-start gap-1.5" style={{ color: "#7A7A6F" }}>
                        <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>Evidence: {q.expectedEvidence.join("; ")}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Flagged claims */}
          {flagged.length > 0 && (
            <section className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-red-700">Could not verify — confirm before using</span>
              <ul className="space-y-1">
                {flagged.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{c.claim}{c.evidence ? <span className="text-red-700/70"> — {c.evidence}</span> : null}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Sources */}
          {shown.sources.length > 0 && (
            <section className="space-y-2 border-t pt-4" style={{ borderColor: BORDER }}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>Sources</span>
              <ul className="space-y-1">
                {shown.sources.map((s, i) => (
                  <li key={i}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs inline-flex items-start gap-1.5 hover:underline" style={{ color: INK }}>
                      <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" style={{ color: ACCENT }} />
                      <span>{s.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
