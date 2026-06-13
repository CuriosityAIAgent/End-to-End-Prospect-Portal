import { useState } from "react";
import { useDraftSourceOfWealth } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  sowStatementFields,
  sowAdditionalField,
} from "@/lib/sowCatalog";
import { engagedCoverage, type FileNoteData } from "@/lib/fileNoteCatalog";
import {
  Sparkles,
  Loader2,
  Check,
  RefreshCw,
  AlertCircle,
  X,
  ScrollText,
} from "lucide-react";

// Maps a statement section id ("sow.overview") to the bare key the API returns
// ("overview").
const stmtKey = (id: string) => id.replace(/^sow\./, "");

type DraftStatement = Record<string, string>;

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
  const [aiError, setAiError] = useState<string | null>(null);

  const previewIsEmpty =
    preview !== null &&
    sowStatementFields.every((f) => (preview[stmtKey(f.id)] ?? "").trim().length === 0);

  const runGenerate = () => {
    setAiError(null);
    setPreview(null);
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
        onSuccess: (res) => setPreview(res.statement as unknown as DraftStatement),
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
    onApply(values);
    setPreview(null);
  };

  const dismissPreview = () => {
    setPreview(null);
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
              from the meeting note and any pre-meeting briefing. Review every line — the assistant
              never fabricates, leaving sections blank where there is no basis, and frames inferences
              as plausibility. Edit freely and add anything further below.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={runGenerate}
            disabled={!canGenerate || draft.isPending}
            className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90"
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
            {previewIsEmpty ? (
              <p className="text-sm text-muted-foreground">
                The meeting note and briefing didn't give enough to draft a statement. Add more
                detail to the note (or generate a briefing) and try again, or complete the sections
                below manually.
              </p>
            ) : (
              sowStatementFields.map((f) => {
                const text = (preview[stmtKey(f.id)] ?? "").trim();
                return (
                  <div key={f.id} className="space-y-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
                      {f.label}
                    </span>
                    {text.length > 0 ? (
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{text}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">No basis in the inputs — left blank.</p>
                    )}
                  </div>
                );
              })
            )}

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              {!previewIsEmpty && (
                <Button
                  onClick={acceptPreview}
                  className="rounded-none bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Check className="w-4 h-4 mr-2" /> Accept &amp; fill statement
                </Button>
              )}
              <Button
                onClick={runGenerate}
                disabled={draft.isPending}
                variant="outline"
                className="rounded-none border-border"
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Retry
              </Button>
              <Button onClick={dismissPreview} variant="ghost" className="rounded-none text-muted-foreground">
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
                className="min-h-[110px] rounded-none border-border bg-card focus-visible:ring-primary print:hidden"
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
          placeholder="Add any further context the relationship manager wishes to record…"
          className="min-h-[100px] rounded-none border-border bg-card focus-visible:ring-primary print:hidden"
        />
        <div className="hidden print:block text-sm whitespace-pre-wrap leading-relaxed">
          {((data[sowAdditionalField.id] as string | undefined) ?? "").trim() || "—"}
        </div>
      </div>
    </div>
  );
}
