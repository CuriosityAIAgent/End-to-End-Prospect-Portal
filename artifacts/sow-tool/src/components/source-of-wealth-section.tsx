import { useState } from "react";
import { useDraftSourceOfWealth } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  sowStatementFields,
  sowAdditionalField,
} from "@/lib/sowCatalog";
import { engagedCoverage, type FileNoteData } from "@/lib/fileNoteCatalog";
import type {
  SourceOfWealthVerification,
  SectionVerification,
} from "@workspace/research-pipeline/types";
import {
  Sparkles,
  Loader2,
  Check,
  RefreshCw,
  AlertCircle,
  X,
  ScrollText,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

// Maps a statement section id ("sow.overview") to the bare key the API returns
// ("overview").
const stmtKey = (id: string) => id.replace(/^sow\./, "");

type DraftStatement = Record<string, string>;

// ── Verification presentation ───────────────────────────────────────────────

const VERDICT_BADGE: Record<
  SectionVerification["verdict"],
  { label: string; className: string } | null
> = {
  supported: { label: "Verified", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  partially_supported: { label: "Partly verified", className: "bg-amber-100 text-amber-800 border-amber-200" },
  unsupported: { label: "Unverified", className: "bg-red-100 text-red-800 border-red-200" },
  empty: null,
};

const CONFIDENCE_BANNER: Record<
  SourceOfWealthVerification["overallConfidence"],
  { className: string; icon: typeof ShieldCheck; label: string }
> = {
  high: {
    className: "bg-emerald-50 border-emerald-200 text-emerald-900",
    icon: ShieldCheck,
    label: "High confidence — every claim traces to the source material.",
  },
  medium: {
    className: "bg-amber-50 border-amber-200 text-amber-900",
    icon: ShieldAlert,
    label: "Medium confidence — review the flagged claims before accepting.",
  },
  low: {
    className: "bg-red-50 border-red-200 text-red-900",
    icon: ShieldAlert,
    label: "Low confidence — several claims could not be verified against the inputs.",
  },
};

function SectionBadge({ verdict }: { verdict: SectionVerification["verdict"] }) {
  const badge = VERDICT_BADGE[verdict];
  if (!badge) return null;
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

export function SourceOfWealthSection({
  data,
  clientName,
  onApply,
  onFieldChange,
}: {
  data: Record<string, any>;
  clientName: string;
  /** Batched merge of the accepted statement into the assessment data blob. */
  onApply: (values: Record<string, string>) => void;
  /** Inline edit of a single field (debounced autosave). */
  onFieldChange: (key: string, value: string) => void;
}) {
  const fileNote = data.fileNote as FileNoteData | undefined;
  const note = (fileNote?.note ?? "").trim();
  const coverage = engagedCoverage(fileNote?.coverage);

  const briefingRaw = data.prospectBriefing as
    | {
        summary?: string;
        talkingPoints?: string[];
        referralRoutes?: string[];
        recommendedApproach?: string;
      }
    | null
    | undefined;
  const hasBriefing =
    !!briefingRaw &&
    (!!briefingRaw.summary?.trim() ||
      (briefingRaw.talkingPoints?.length ?? 0) > 0 ||
      (briefingRaw.referralRoutes?.length ?? 0) > 0 ||
      !!briefingRaw.recommendedApproach?.trim());

  const canGenerate = note.length > 0 || hasBriefing;
  const hasStatement = sowStatementFields.some(
    (f) => ((data[f.id] as string | undefined) ?? "").trim().length > 0,
  );
  const generatedAt = data["sow.generatedAt"] as string | undefined;

  const draft = useDraftSourceOfWealth();
  const [preview, setPreview] = useState<DraftStatement | null>(null);
  const [verification, setVerification] = useState<SourceOfWealthVerification | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const verdictBySection = new Map(
    (verification?.sections ?? []).map((s) => [s.section, s] as const),
  );

  const previewIsEmpty =
    preview !== null &&
    sowStatementFields.every((f) => (preview[stmtKey(f.id)] ?? "").trim().length === 0);

  const runGenerate = () => {
    setAiError(null);
    setPreview(null);
    setVerification(null);
    draft.mutate(
      {
        data: {
          clientName,
          note: note.length > 0 ? note : undefined,
          coverage: coverage.length > 0 ? coverage : undefined,
          briefing:
            hasBriefing && briefingRaw
              ? {
                  summary: briefingRaw.summary,
                  talkingPoints: briefingRaw.talkingPoints,
                  referralRoutes: briefingRaw.referralRoutes,
                  recommendedApproach: briefingRaw.recommendedApproach,
                }
              : undefined,
        },
      },
      {
        onSuccess: (res) => {
          setPreview(res.statement as unknown as DraftStatement);
          // `verification` is appended by the API alongside the statement (not
          // yet in the generated contract), so read it defensively.
          setVerification(
            (res as { verification?: SourceOfWealthVerification }).verification ?? null,
          );
        },
        onError: () => setAiError("The statement could not be drafted. Please try again."),
      },
    );
  };

  const acceptPreview = () => {
    if (!preview) return;
    const values: Record<string, string> = {};
    sowStatementFields.forEach((f) => {
      values[f.id] = preview[stmtKey(f.id)] ?? "";
    });
    values["sow.generatedAt"] = new Date().toISOString();
    // Durable audit footprint of the verification pass that accompanied this draft.
    if (verification) {
      values["sow.verifiedAt"] = verification.verifiedAt;
      values["sow.verifiedConfidence"] = verification.overallConfidence;
      values["sow.flaggedCount"] = String(verification.flaggedCount);
    }
    onApply(values);
    setPreview(null);
    setVerification(null);
  };

  const dismissPreview = () => {
    setPreview(null);
    setVerification(null);
    setAiError(null);
  };

  return (
    <div className="space-y-8">
      {/* Intro + generate action */}
      <div className="border border-border bg-secondary/20 p-5 print:hidden">
        <div className="flex items-start gap-3">
          <ScrollText className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h3 className="font-serif text-lg">Source of Wealth statement</h3>
            <p className="text-sm text-muted-foreground">
              Draft a regulator-facing narrative of how the client built their wealth, synthesised
              from the meeting note and pre-meeting briefing. Written in a definitive voice — the
              conversations have happened — stating what the client has confirmed; it never
              fabricates and leaves a section blank where there is no basis. Review every line, edit
              freely, and add anything further below.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={runGenerate}
            disabled={!canGenerate || draft.isPending}
            className="rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {draft.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Drafting…</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> {hasStatement ? "Re-draft statement" : "Generate statement"}</>
            )}
          </Button>
          {!canGenerate && (
            <span className="text-xs text-muted-foreground">
              Write a meeting note (or carry over a briefing) to draft from.
            </span>
          )}
          {generatedAt && (
            <span className="text-xs text-muted-foreground">
              Last drafted {new Date(generatedAt).toLocaleString()}
            </span>
          )}
        </div>

        {aiError && (
          <div className="flex items-center gap-2 text-sm text-destructive mt-3">
            <AlertCircle className="w-4 h-4" /> {aiError}
          </div>
        )}
      </div>

      {/* Draft preview — review before accepting */}
      {preview !== null && (
        <div className="border border-primary/30 bg-primary/[0.03] print:hidden">
          <div className="px-4 py-2.5 border-b border-border bg-primary/5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Drafted statement — review before accepting
            </span>
          </div>
          <div className="p-4 space-y-5">
            {/* Cross-model verification summary */}
            {verification && !previewIsEmpty && (() => {
              const banner = CONFIDENCE_BANNER[verification.overallConfidence];
              const Icon = banner.icon;
              return (
                <div className={`flex items-start gap-2.5 border px-3 py-2.5 rounded ${banner.className}`}>
                  <Icon className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-snug">{banner.label}</p>
                    <p className="text-xs opacity-80">
                      Independently checked by {verification.verifierModel}
                      {verification.flaggedCount > 0
                        ? ` · ${verification.flaggedCount} claim${verification.flaggedCount === 1 ? "" : "s"} could not be verified`
                        : " · all claims trace to the inputs"}
                    </p>
                  </div>
                </div>
              );
            })()}

            {previewIsEmpty ? (
              <p className="text-sm text-muted-foreground">
                The meeting note and briefing didn't give enough to draft a statement. Add more
                detail to the note (or generate a briefing) and try again, or complete the sections
                below manually.
              </p>
            ) : (
              sowStatementFields.map((f) => {
                const text = (preview[stmtKey(f.id)] ?? "").trim();
                const sv = verdictBySection.get(stmtKey(f.id));
                const flagged = (sv?.claims ?? []).filter((c) => c.status === "unsupported");
                return (
                  <div key={f.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                        {f.label}
                      </span>
                      {sv && <SectionBadge verdict={sv.verdict} />}
                    </div>
                    {text.length > 0 ? (
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{text}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No basis in the inputs — left blank.</p>
                    )}
                    {flagged.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {flagged.map((c, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>
                              <span className="font-medium">Could not verify:</span> {c.claim}
                              {c.evidence ? <span className="text-red-700/70"> — {c.evidence}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })
            )}

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              {!previewIsEmpty && (
                <Button
                  onClick={acceptPreview}
                  className="rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Check className="w-4 h-4 mr-2" /> Accept &amp; fill statement
                </Button>
              )}
              <Button
                onClick={runGenerate}
                disabled={draft.isPending}
                variant="outline"
                className="rounded-md border-border"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Retry
              </Button>
              <Button onClick={dismissPreview} variant="ghost" className="rounded-md text-muted-foreground">
                <X className="w-4 h-4 mr-2" /> Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* The statement document (editable; accepted drafts land here) */}
      <div className="space-y-8">
        {sowStatementFields.map((f) => {
          const val = (data[f.id] as string | undefined) ?? "";
          return (
            <div key={f.id} className="space-y-2">
              <label className="text-sm font-semibold text-foreground/90">{f.label}</label>
              <p className="text-xs text-muted-foreground print:hidden">{f.hint}</p>
              <Textarea
                value={val}
                onChange={(e) => onFieldChange(f.id, e.target.value)}
                placeholder="No basis recorded yet — draft above or write manually."
                className="min-h-[110px] rounded-md border-border bg-card focus-visible:ring-primary print:hidden"
              />
              <div className="hidden print:block text-sm whitespace-pre-wrap leading-relaxed">
                {val.trim().length > 0 ? val : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Additional information — manual, never AI-generated */}
      <div className="space-y-2 border-t border-border pt-6">
        <label className="text-sm font-semibold text-foreground/90">{sowAdditionalField.label}</label>
        <p className="text-xs text-muted-foreground print:hidden">{sowAdditionalField.hint}</p>
        <Textarea
          value={(data[sowAdditionalField.id] as string | undefined) ?? ""}
          onChange={(e) => onFieldChange(sowAdditionalField.id, e.target.value)}
          placeholder="Add any further context the banker wishes to record…"
          className="min-h-[100px] rounded-md border-border bg-card focus-visible:ring-primary print:hidden"
        />
        <div className="hidden print:block text-sm whitespace-pre-wrap leading-relaxed">
          {((data[sowAdditionalField.id] as string | undefined) ?? "").trim() || "—"}
        </div>
      </div>
    </div>
  );
}
