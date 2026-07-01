import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch, getGetProspectQueryKey } from "@workspace/api-client-react";
import type { PrepPack } from "@workspace/research-pipeline/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sparkles, Loader2, AlertCircle, ShieldCheck, ShieldAlert,
  Phone, ScrollText, Compass, ExternalLink, FileText, Check, Gauge, Layers,
  Mail, Copy, Newspaper, HelpCircle,
} from "lucide-react";
import type { MarketRead, Approach, ColdCallScript, CarrySpec } from "@workspace/research-pipeline/types";

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

// Carried-interest workings — shown under a carry line as a conversation hook
// ("you were a senior partner ~12 yrs on a $3bn fund — that's roughly $X").
function carryWorkings(c: CarrySpec): string {
  const pool = Math.round((c.carryPoolRate ?? 0.2) * 100);
  const tax = Math.round((c.taxRate ?? 0.22) * 100);
  const mult = c.grossMultiple?.base ?? 2.0;
  const pctNum = c.personalCarryPct.base * 100;
  const pct = Number.isInteger(pctNum) ? `${pctNum}` : pctNum.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${fmtMoney(c.fundSizeUsd, "USD")} fund · ${pct}% carry · ${mult}× gross · ${pool}% pool · net of ${tax}% tax`;
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

// ── Qualification gate (>$25M?) ─────────────────────────────────────────────
// Per banker feedback the only question at this stage is "does the prospect
// clear the bar?" — a precise range is too wide to be useful. We show the
// verdict; the range stays internal (it drives this gate + the SoW questions).
const QUALIFY_THRESHOLD_USD = 25_000_000;
// Approximate FX → USD for the legacy-pack fallback (kept in sync with
// research-pipeline's toUsdApprox; duplicated rather than importing server
// runtime into the browser bundle). Coarse is fine for a $25M gate.
const APPROX_USD_PER: Record<string, number> = {
  USD: 1, GBP: 1.27, EUR: 1.08, CHF: 1.1, CAD: 0.73, AUD: 0.66, SGD: 0.74, HKD: 0.128, JPY: 0.0064,
};
const QUAL_STYLE: Record<
  "above" | "borderline" | "below",
  { className: string; verdict: string }
> = {
  above: { className: "bg-emerald-50 border-emerald-200 text-emerald-800", verdict: "Qualifies" },
  borderline: { className: "bg-amber-50 border-amber-200 text-amber-800", verdict: "Borderline" },
  below: { className: "bg-stone-100 border-stone-300 text-stone-600", verdict: "Below the bar" },
};

/** Use the server-computed gate when present; else derive from the range for
 * back-compat with packs generated before the gate existed. Exported so the
 * Plan-of-action header derives the SAME verdict (legacy packs included). */
export function resolveQualification(
  estimate: NonNullable<PrepPack["wealthEstimate"]>,
): { verdict: "above" | "borderline" | "below"; threshold: number; currency: string; rationale: string } | null {
  if (estimate.qualification) return estimate.qualification;
  const t = estimate.totalNetWorth;
  if (!t || (t.low === 0 && t.high === 0)) return null;
  // Normalise to USD before judging against the USD bar — legacy (pre-gate) packs
  // were often GBP, and comparing a £ range raw against a $ bar would mislabel
  // exactly the data this fallback exists to serve. Unknown currency → no verdict.
  const rate = APPROX_USD_PER[t.currency];
  if (!rate) return null;
  const lowUsd = t.low * rate;
  const highUsd = t.high * rate;
  const verdict = lowUsd >= QUALIFY_THRESHOLD_USD ? "above" : highUsd < QUALIFY_THRESHOLD_USD ? "below" : "borderline";
  return { verdict, threshold: QUALIFY_THRESHOLD_USD, currency: "USD", rationale: "" };
}

export function WealthEstimatePanel({ estimate }: { estimate: NonNullable<PrepPack["wealthEstimate"]> }) {
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
  const qual = resolveQualification(estimate);
  const qstyle = qual ? QUAL_STYLE[qual.verdict] : null;
  const bar = qual ? fmtMoney(qual.threshold, qual.currency) : "$25M";
  return (
    <section className="border rounded p-6 space-y-4" style={{ borderColor: BORDER, background: "#FBFAF7" }}>
      <Eyebrow>Wealth Qualification</Eyebrow>
      <div className="space-y-2">
        <div className="flex items-baseline gap-3">
          <p className="text-[34px] leading-none font-normal" style={{ fontFamily: SERIF, color: INK }}>
            {qstyle ? qstyle.verdict : "—"}
          </p>
          <span className="text-sm" style={{ color: "#7A7A6F" }}>
            against a {bar} net-worth bar
          </span>
        </div>
        {qual?.rationale && (
          <p className="text-[15px] leading-[1.5]" style={{ color: INK }}>{qual.rationale}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {qstyle && (
          <span className={`text-xs px-2 py-0.5 border rounded ${qstyle.className}`}>
            {qual!.verdict === "above" ? `Above ${bar}` : qual!.verdict === "below" ? `Below ${bar}` : `Around ${bar}`}
          </span>
        )}
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
                  {l.carry && (
                    <span className="basis-full text-xs" style={{ color: "#7A7A6F" }}>
                      ↳ {carryWorkings(l.carry)}
                    </span>
                  )}
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

// ── "Our read" — structured, with legacy prose fallback ─────────────────────
export function ReadSection({ read, fallback }: { read?: MarketRead; fallback: string }) {
  if (!read || (!read.narrative?.trim() && !read.headline?.trim() && (read.keyFacts?.length ?? 0) === 0 && (read.themes?.length ?? 0) === 0)) {
    if (!fallback.trim()) return null;
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2"><Compass className="w-4 h-4" style={{ color: ACCENT }} /><SectionTitle>Our read</SectionTitle></div>
        <p className="text-[15px] leading-[1.6] whitespace-pre-line" style={{ color: INK }}>{fallback}</p>
      </section>
    );
  }
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-2"><Compass className="w-4 h-4" style={{ color: ACCENT }} /><SectionTitle>Our read</SectionTitle></div>

      {/* Narrative — the qualitative lead the banker opens the meeting with */}
      {read.narrative?.trim() && (
        <p className="text-[15px] leading-[1.65]" style={{ color: INK }}>{read.narrative}</p>
      )}

      {/* Headline — set apart in a tinted band so it lands first */}
      {read.headline?.trim() && (
        <div className="border-l-2 pl-4 py-1" style={{ borderColor: ACCENT }}>
          <p className="text-[18px] leading-snug" style={{ fontFamily: SERIF, color: INK }}>{read.headline}</p>
        </div>
      )}

      {/* Key facts — scannable boxes, one fact each */}
      {(read.keyFacts?.length ?? 0) > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {(read.keyFacts ?? []).map((f, i) => (
            <div key={i} className="border rounded-md px-3.5 py-2.5" style={{ borderColor: BORDER, background: "#FBFAF7" }}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-0.5" style={{ color: ACCENT }}>{f.label}</div>
              <div className="text-[14px] leading-snug" style={{ color: INK }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Themes — each its own card with an accent spine and an airy fact list */}
      {(read.themes?.length ?? 0) > 0 && (
        <div className="space-y-3">
          {(read.themes ?? []).map((t) => (
            <div key={t.id} className="border rounded-md overflow-hidden flex" style={{ borderColor: BORDER }}>
              <div className="w-1 shrink-0" style={{ background: ACCENT }} />
              <div className="flex-1 p-4">
                <div className="mb-2.5">
                  <h4 className="text-[15px] font-semibold" style={{ color: INK }}>{t.heading}</h4>
                  {t.takeaway && <p className="text-[13px] leading-snug mt-0.5" style={{ color: "#7A7A6F" }}>{t.takeaway}</p>}
                </div>
                {(t.facts?.length ?? 0) > 0 && (
                  <ul className="space-y-2">
                    {(t.facts ?? []).map((f, j) => (
                      <li key={j} className="text-[14px] leading-[1.5] pl-4 relative" style={{ color: INK }}>
                        <span className="absolute left-0 top-[0.45em] w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
                        {f.text}
                        {f.basis === "inference" && (
                          <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border align-middle" style={{ color: "#9A7B00", borderColor: "#E4D8A8", background: "#FCF8E8" }}>inferred</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── "The approach" — Email/Call tabs with angled variants + copy ────────────
function CopyButton({ text, onCopied }: { text: string; onCopied?: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          onCopied?.();
          setTimeout(() => setDone(false), 1800);
        });
      }}
      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 border rounded hover:bg-black/[0.03]"
      style={{ borderColor: BORDER, color: done ? ACCENT : INK }}
    >
      {done ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
    </button>
  );
}

export function ApproachSection({
  approach,
  fallback,
  onCopyVariant,
}: {
  approach?: Approach;
  /** Optional legacy cold-call script. May be absent on older carried data. */
  fallback?: ColdCallScript;
  onCopyVariant?: (channel: "email" | "call", variantId: string, label: string) => void;
}) {
  // Tolerate partial/legacy carried data — any of these arrays can be missing.
  const emails = approach?.email ?? [];
  const calls = approach?.call ?? [];
  const hasApproach = emails.length > 0 || calls.length > 0;

  // Default to the first channel that actually has content, so a call-only
  // (or email-only) carried payload doesn't render as a blank Email tab.
  const [channel, setChannel] = useState<"email" | "call">(
    emails.length === 0 && calls.length > 0 ? "call" : "email",
  );
  const [idx, setIdx] = useState<{ email: number; call: number }>({ email: 0, call: 0 });
  const objections = approach?.anticipatedObjections ?? fallback?.anticipatedObjections ?? [];

  if (!hasApproach) {
    // Legacy single cold-call script.
    const opener = fallback?.opener?.trim() ?? "";
    const talkingPoints = fallback?.talkingPoints ?? [];
    if (!opener && talkingPoints.length === 0) return null;
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2"><Phone className="w-4 h-4" style={{ color: ACCENT }} /><SectionTitle>The approach</SectionTitle></div>
        {opener && <p className="text-[15px] leading-[1.6] italic" style={{ color: INK }}>“{opener}”</p>}
        {talkingPoints.length > 0 && (
          <ul className="space-y-1.5">
            {talkingPoints.map((t, i) => (
              <li key={i} className="text-[15px] leading-[1.55] pl-4 relative" style={{ color: INK }}><span className="absolute left-0" style={{ color: ACCENT }}>—</span>{t}</li>
            ))}
          </ul>
        )}
        {objections.length > 0 && <ObjectionList objections={objections} />}
      </section>
    );
  }

  const variants = channel === "email" ? emails : calls;
  const active = idx[channel];
  const v = variants[Math.min(active, variants.length - 1)];

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2"><Phone className="w-4 h-4" style={{ color: ACCENT }} /><SectionTitle>The approach</SectionTitle></div>

      {/* Channel tabs */}
      <div className="flex gap-4 border-b" style={{ borderColor: BORDER }}>
        {([
          { key: "email", icon: Mail, label: `Email${emails.length ? ` (${emails.length})` : ""}` },
          { key: "call", icon: Phone, label: `Call${calls.length ? ` (${calls.length})` : ""}` },
        ] as const).map((c) => {
          const on = channel === c.key;
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setChannel(c.key)}
              className="inline-flex items-center gap-1.5 pb-2 -mb-px text-sm border-b-2"
              style={{ borderColor: on ? ACCENT : "transparent", color: on ? INK : "#7A7A6F", fontWeight: on ? 600 : 400 }}
            >
              <Icon className="w-3.5 h-3.5" /> {c.label}
            </button>
          );
        })}
      </div>

      {/* Variant switcher */}
      {variants.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {variants.map((opt, i) => {
            const on = i === active;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setIdx((s) => ({ ...s, [channel]: i }))}
                className="text-xs px-2.5 py-1 rounded-full border"
                style={on ? { background: ACCENT, color: "#fff", borderColor: ACCENT } : { borderColor: BORDER, color: "#4A4A4A" }}
              >
                v{i + 1} · {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Active variant card */}
      {v && (
        <div className="border rounded p-4 space-y-3" style={{ borderColor: BORDER, background: "#FBFAF7" }}>
          {v.rationale && <p className="text-xs" style={{ color: "#7A7A6F" }}>{v.rationale}</p>}
          {v.newsHook && (
            <p className="text-xs flex items-start gap-1.5" style={{ color: ACCENT }}>
              <Newspaper className="w-3.5 h-3.5 mt-0.5 shrink-0" /> <span>Leans on: {v.newsHook}</span>
            </p>
          )}
          {channel === "email" ? (
            <>
              <p className="text-sm" style={{ color: INK }}><span className="font-semibold">Subject:</span> {(v as Approach["email"][number]).subject}</p>
              <p className="text-[15px] leading-[1.6] whitespace-pre-line" style={{ color: INK }}>{(v as Approach["email"][number]).body}</p>
              <CopyButton
                text={`Subject: ${(v as Approach["email"][number]).subject}\n\n${(v as Approach["email"][number]).body}`}
                onCopied={() => onCopyVariant?.("email", v.id, v.label)}
              />
            </>
          ) : (
            <>
              <p className="text-[15px] leading-[1.6] italic" style={{ color: INK }}>“{(v as Approach["call"][number]).opener}”</p>
              {((v as Approach["call"][number]).flow?.length ?? 0) > 0 && (
                <ol className="space-y-1.5">
                  {((v as Approach["call"][number]).flow ?? []).map((beat, i) => (
                    <li key={i} className="text-[14px] leading-[1.5] flex gap-2" style={{ color: INK }}>
                      <span style={{ color: ACCENT }}>{i + 1}.</span> {beat}
                    </li>
                  ))}
                </ol>
              )}
              <CopyButton
                text={`${(v as Approach["call"][number]).opener}\n\n${((v as Approach["call"][number]).flow ?? []).map((b, i) => `${i + 1}. ${b}`).join("\n")}`}
                onCopied={() => onCopyVariant?.("call", v.id, v.label)}
              />
            </>
          )}
        </div>
      )}

      {objections.length > 0 && <ObjectionList objections={objections} />}
    </section>
  );
}

function ObjectionList({ objections }: { objections: { objection: string; response: string }[] }) {
  return (
    <div className="space-y-2 pt-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>Likely pushback</span>
      {objections.map((o, i) => (
        <div key={i} className="border-l-2 pl-3" style={{ borderColor: BORDER }}>
          <p className="text-sm font-medium" style={{ color: INK }}>“{o.objection}”</p>
          <p className="text-sm" style={{ color: "#4A4A4A" }}>{o.response}</p>
        </div>
      ))}
    </div>
  );
}

export function ProspectPrepPanel({
  prospectId,
  prospectName,
  prep,
  industry,
  knownInfo,
  onFieldChange,
  onApproachCopy,
  view = "full",
}: {
  prospectId: number;
  prospectName: string;
  prep?: PrepPack;
  industry?: string;
  knownInfo?: string;
  /** Debounced autosave of a single prospect.data field. */
  onFieldChange?: (key: string, value: string) => void;
  /** Capture which outreach variant the banker copies (lightweight learning). */
  onApproachCopy?: (channel: "email" | "call", variantId: string, label: string) => void;
  /** "brief" hides the approach block when it is rendered in its own step. */
  view?: "full" | "brief";
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
            {shown ? `Walk in prepared on ${prospectName}.` : `Here's how we'll help you win ${prospectName}.`}
          </h2>
          {shown ? (
            <p className="text-sm leading-relaxed max-w-[60ch]" style={{ color: "#4A4A4A" }}>
              A researched read of where the wealth likely sits — across companies, trusts, foundations
              and offshore structures — with a cold-call script and the Source-of-Wealth questions to ask,
              each paired with an anticipated answer to validate with the client. Drafted, independently
              verified, never to be presented as fact unverified.
            </p>
          ) : (
            <div className="text-sm leading-relaxed max-w-[62ch] space-y-3" style={{ color: "#4A4A4A" }}>
              <p>
                We'll take you end to end on this prospect. First, we'll run the searches and prepare a
                pre-meeting briefing pack — where the wealth likely sits, and the questions to ask — so
                you can walk into a potential meeting fully prepared.
              </p>
              <p>
                Then we'll guide you step by step through calling or emailing them, with ready-to-use
                templates and hints for success. Once you've met, we'll help you complete a solid file
                note of the meeting — and that becomes the basis of the Source-of-Wealth document you'll
                need to submit if you go on to onboard them.
              </p>
              <p>
                Finally, we'll pull together everything you've gathered to populate that Source-of-Wealth
                and onboard the client seamlessly.
              </p>
            </div>
          )}
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
          {/* Our read — the qualitative narrative LEADS (the banker's conversation
              opener). Per Rupert the brief should read as a story first — how the
              wealth was built, the career arc — not a dossier of numbers. */}
          <ReadSection read={shown.read} fallback={shown.marketRead} />

          {/* Net-worth qualifier — the >$25M gate, beneath the narrative */}
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

          {/* The approach — Email/Call variants (legacy cold-call fallback).
              Hidden here when it has its own step (view="brief"). */}
          {view === "full" && (
            <ApproachSection approach={shown.approach} fallback={shown.coldCall} onCopyVariant={onApproachCopy} />
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
              <ol className="space-y-4">
                {shown.sourceOfWealth.questions.slice(0, 5).map((q, i) => (
                  <li key={i} className="border rounded-md p-5" style={{ borderColor: BORDER, background: PAPER }}>
                    {/* The question */}
                    <div className="flex gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold" style={{ background: ACCENT, color: "#fff" }}>{i + 1}</span>
                      <p className="text-[16px] leading-snug font-medium pt-0.5" style={{ color: INK }}>{q.question}</p>
                    </div>

                    {/* Likely answer — the standout: highlighted box */}
                    {q.suggestedAnswer && (
                      <div className="mt-3 rounded-md border-l-2 px-3.5 py-2.5" style={{ borderColor: ACCENT, background: "rgba(14,156,119,0.06)" }}>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: ACCENT }}>Likely answer · validate with client</div>
                        <p className="text-[14px] leading-relaxed" style={{ color: INK }}>{q.suggestedAnswer}</p>
                      </div>
                    )}

                    {/* Why it matters + Evidence — coded metadata */}
                    {(q.why || q.expectedEvidence.length > 0) && (
                      <div className="mt-3 space-y-2">
                        {q.why && (
                          <div className="flex items-start gap-2 text-[12px]">
                            <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: "#8A6D00", background: "#FCF8E8", border: "1px solid #ECE2B8" }}>
                              <HelpCircle className="w-3 h-3" /> Why
                            </span>
                            <span className="leading-snug pt-0.5" style={{ color: "#6B6B60" }}>{q.why}</span>
                          </div>
                        )}
                        {q.expectedEvidence.length > 0 && (
                          <div className="flex items-start gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5" style={{ color: ACCENT, background: "rgba(14,156,119,0.08)", border: "1px solid rgba(14,156,119,0.25)" }}>
                              <FileText className="w-3 h-3" /> Evidence
                            </span>
                            {q.expectedEvidence.map((e, k) => (
                              <span key={k} className="inline-flex items-center text-[11px] px-2 py-0.5 border rounded-full" style={{ borderColor: BORDER, color: "#5A5A50", background: "#FBFAF7" }}>{e}</span>
                            ))}
                          </div>
                        )}
                      </div>
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
