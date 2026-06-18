import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch, getGetProspectQueryKey } from "@workspace/api-client-react";
import type { PrepPack } from "@workspace/research-pipeline/types";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Loader2, AlertCircle, ShieldCheck, ShieldAlert,
  Phone, ScrollText, Compass, ExternalLink, FileText,
} from "lucide-react";

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

  const generate = useMutation({
    mutationFn: () =>
      customFetch<unknown>(`/api/prospects/${prospectId}/prep`, { method: "POST" }),
    onMutate: () => setError(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getGetProspectQueryKey(prospectId) });
    },
    onError: () => setError("The prep pack could not be generated. Please try again."),
  });

  const flagged = (prep?.verification?.sections ?? []).flatMap((s) =>
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

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="rounded-md text-white hover:opacity-90"
          style={{ background: ACCENT }}
        >
          {generate.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Researching &amp; drafting…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> {prep ? "Regenerate prep pack" : "Generate prep pack"}</>
          )}
        </Button>
        {prep?.generatedAt && (
          <span className="text-xs" style={{ color: "#7A7A6F" }}>
            Last prepared {new Date(prep.generatedAt).toLocaleString()}
          </span>
        )}
        {generate.isPending && (
          <span className="text-xs" style={{ color: "#7A7A6F" }}>
            Deep research runs several searches — this can take a moment.
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {prep && (
        <div className="space-y-10 pt-2">
          {/* Verification banner */}
          {prep.verification && (() => {
            const b = CONFIDENCE[prep.verification.overallConfidence];
            const Icon = b.icon;
            return (
              <div className={`flex items-start gap-2.5 border px-3 py-2.5 rounded ${b.className}`}>
                <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium leading-snug">{b.label}</p>
                  <p className="text-xs opacity-80">
                    Independently checked by {prep.verification.verifierModel}
                    {prep.verification.flaggedCount > 0
                      ? ` · ${prep.verification.flaggedCount} point${prep.verification.flaggedCount === 1 ? "" : "s"} to verify`
                      : " · all points corroborated"}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Market read */}
          {prep.marketRead.trim() && (
            <section className="space-y-3">
              <div className="flex items-center gap-2"><Compass className="w-4 h-4" style={{ color: ACCENT }} /><SectionTitle>Our read</SectionTitle></div>
              <p className="text-[15px] leading-[1.6] whitespace-pre-line" style={{ color: INK }}>{prep.marketRead}</p>
            </section>
          )}

          {/* Cold call */}
          {(prep.coldCall.opener.trim() || prep.coldCall.talkingPoints.length > 0) && (
            <section className="space-y-3">
              <div className="flex items-center gap-2"><Phone className="w-4 h-4" style={{ color: ACCENT }} /><SectionTitle>The approach</SectionTitle></div>
              {prep.coldCall.opener.trim() && (
                <p className="text-[15px] leading-[1.6] italic" style={{ color: INK }}>“{prep.coldCall.opener}”</p>
              )}
              {prep.coldCall.talkingPoints.length > 0 && (
                <ul className="space-y-1.5">
                  {prep.coldCall.talkingPoints.map((t, i) => (
                    <li key={i} className="text-[15px] leading-[1.55] pl-4 relative" style={{ color: INK }}>
                      <span className="absolute left-0" style={{ color: ACCENT }}>—</span>{t}
                    </li>
                  ))}
                </ul>
              )}
              {prep.coldCall.anticipatedObjections.length > 0 && (
                <div className="space-y-2 pt-2">
                  {prep.coldCall.anticipatedObjections.map((o, i) => (
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
          {prep.sourceOfWealth.questions.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2"><ScrollText className="w-4 h-4" style={{ color: ACCENT }} /><SectionTitle>Source of Wealth — questions to validate</SectionTitle></div>
              {prep.sourceOfWealth.likelyCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {prep.sourceOfWealth.likelyCategories.map((c) => (
                    <span key={c} className="text-[11px] uppercase tracking-wider px-2 py-0.5 border rounded" style={{ borderColor: BORDER, color: ACCENT }}>{c}</span>
                  ))}
                </div>
              )}
              <ol className="space-y-5">
                {prep.sourceOfWealth.questions.map((q, i) => (
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
          {prep.sources.length > 0 && (
            <section className="space-y-2 border-t pt-4" style={{ borderColor: BORDER }}>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: ACCENT }}>Sources</span>
              <ul className="space-y-1">
                {prep.sources.map((s, i) => (
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
