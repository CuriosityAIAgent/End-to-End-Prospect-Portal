import { useState } from "react";
import { useRewriteFileNote } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  coverageDimensions,
  meetingTypes,
  isCovered,
  engagedCoverage,
  type FileNoteData,
  type CoverageEntry,
} from "@/lib/fileNoteCatalog";
import {
  NotebookPen,
  Sparkles,
  Wand2,
  Check,
  RefreshCw,
  Loader2,
  Copy,
  ClipboardCheck,
  AlertCircle,
  Layers,
} from "lucide-react";

const todayIso = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
};

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function FileNotePanel({
  value,
  onChange,
  contactName,
  defaultMeetingType,
}: {
  value: FileNoteData | undefined;
  onChange: (next: FileNoteData) => void;
  contactName: string;
  defaultMeetingType?: string;
}) {
  const fn = value ?? {};
  const effective: Required<Pick<FileNoteData, "meetingType" | "date" | "note">> & {
    coverage: Record<string, CoverageEntry>;
  } = {
    meetingType: fn.meetingType ?? defaultMeetingType ?? meetingTypes[0],
    date: fn.date ?? todayIso(),
    note: fn.note ?? "",
    coverage: fn.coverage ?? {},
  };

  const [preview, setPreview] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"rewrite" | "enhance" | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const rewrite = useRewriteFileNote();

  const words = countWords(effective.note);
  const hasNote = effective.note.trim().length > 0;
  const hasCoverage = coverageDimensions.some((dim) => {
    const entry = effective.coverage[dim.id];
    return !!entry && isCovered(entry.value);
  });

  const patch = (p: Partial<FileNoteData>) => {
    onChange({ ...effective, ...p });
  };

  const setCoverage = (id: string, entry: CoverageEntry) => {
    patch({ coverage: { ...effective.coverage, [id]: entry } });
  };

  const runRewrite = () => {
    setAiError(null);
    setPreviewMode("rewrite");
    setPreview(null);
    rewrite.mutate(
      {
        data: {
          contact: contactName,
          meetingType: effective.meetingType,
          date: effective.date,
          note: effective.note,
        },
      },
      {
        onSuccess: (res) => setPreview(res.note),
        onError: () => {
          setAiError("The note could not be rewritten. Please try again.");
          setPreviewMode(null);
        },
      },
    );
  };

  const runEnhance = () => {
    setAiError(null);
    setPreviewMode("enhance");
    setPreview(null);
    const coverage = engagedCoverage(effective.coverage);
    rewrite.mutate(
      {
        data: {
          contact: contactName,
          meetingType: effective.meetingType,
          date: effective.date,
          note: effective.note,
          coverage,
        },
      },
      {
        onSuccess: (res) => setPreview(res.note),
        onError: () => {
          setAiError("The note could not be enhanced. Please try again.");
          setPreviewMode(null);
        },
      },
    );
  };

  const acceptPreview = () => {
    if (preview) patch({ note: preview });
    setPreview(null);
    setPreviewMode(null);
  };

  const discardPreview = () => {
    setPreview(null);
    setPreviewMode(null);
    setAiError(null);
  };

  const copyNote = () => {
    const formatted = [
      "FILE NOTE",
      "=========",
      `Contact: ${contactName}`,
      `Meeting type: ${effective.meetingType}`,
      `Date: ${effective.date}`,
      "",
      effective.note,
      "",
      `Generated: ${new Date().toLocaleString()}`,
    ].join("\n");
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const coveredForPrint = coverageDimensions
    .map((dim) => ({ dim, entry: effective.coverage[dim.id] }))
    .filter(({ dim, entry }) => isCovered(entry?.value ?? dim.options[0].value) && !!entry);

  return (
    <div className="border border-primary/20 bg-card shadow-sm">
      {/* Header */}
      <div className="p-5 border-b border-border flex items-start gap-3 bg-primary/5">
        <NotebookPen className="w-5 h-5 text-primary mt-0.5" />
        <div>
          <h2 className="font-serif text-xl">Meeting File Note</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Capture the conversation in your own words, then let the assistant shape it into a
            regulator-ready file note. Confirm what you covered to colour in the full picture.
          </p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-8">
        {/* Meeting metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</label>
            <div className="h-9 flex items-center px-3 border border-border bg-secondary/40 text-sm font-medium">
              {contactName}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Meeting Type</label>
            <Select value={effective.meetingType} onValueChange={(v) => patch({ meetingType: v })}>
              <SelectTrigger className="h-9 rounded-none border-border bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {meetingTypes.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</label>
            <Input
              type="date"
              value={effective.date}
              onChange={(e) => patch({ date: e.target.value })}
              className="h-9 rounded-none border-border bg-background text-sm"
            />
          </div>
        </div>

        {/* Raw note */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-foreground/90">Your notes</label>
            <span className="text-xs text-muted-foreground tabular-nums">{words} {words === 1 ? "word" : "words"}</span>
          </div>
          <p className="text-xs text-muted-foreground print:hidden">
            Jot it down however it comes out — names, numbers, what was said, what you promised. The detail
            you add here is what the rewrite has to work with.
          </p>
          <Textarea
            value={effective.note}
            onChange={(e) => patch({ note: e.target.value })}
            placeholder="e.g. Met David at his office. Recently sold his logistics business, ~£40m proceeds. Worried about IHT, two kids at university. Mentioned his current bank has been slow on a property facility..."
            className="min-h-[200px] rounded-none border-border bg-background focus-visible:ring-primary print:hidden"
          />
          {/* Print-only static rendering of the note */}
          <div className="hidden print:block whitespace-pre-wrap text-sm leading-relaxed border border-border p-4">
            {effective.note || "(No note recorded.)"}
          </div>
        </div>

        {/* AI actions */}
        <div className="flex flex-col gap-4 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={runRewrite}
              disabled={!hasNote || rewrite.isPending}
              className="rounded-none bg-primary text-primary-foreground"
            >
              {rewrite.isPending && previewMode === "rewrite" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Rewriting...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Rewrite in professional format</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={copyNote}
              disabled={!hasNote}
              className="rounded-none border-border hover:bg-secondary"
            >
              {copied ? (
                <><ClipboardCheck className="w-4 h-4 mr-2 text-emerald-600" /> Copied</>
              ) : (
                <><Copy className="w-4 h-4 mr-2" /> Copy</>
              )}
            </Button>
            {hasNote && words < 25 && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Short notes give thin rewrites — add more colour.
              </span>
            )}
          </div>

          {aiError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" /> {aiError}
            </div>
          )}

          {/* Preview */}
          {(rewrite.isPending && preview === null) || preview !== null ? (
            <div className="border border-primary/30 bg-primary/[0.03]">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-primary/5">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  {previewMode === "enhance" ? "Enhanced draft" : "Professional draft"}
                </span>
              </div>
              <div className="p-4">
                {preview === null ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    {previewMode === "enhance" ? "Weaving in your coverage..." : "Drafting your file note..."}
                  </div>
                ) : (
                  <>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 max-h-[420px] overflow-y-auto">
                      {preview}
                    </div>
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                      <Button onClick={acceptPreview} className="rounded-none bg-emerald-600 text-white hover:bg-emerald-700">
                        <Check className="w-4 h-4 mr-2" /> Accept &amp; replace note
                      </Button>
                      <Button
                        variant="outline"
                        onClick={previewMode === "enhance" ? runEnhance : runRewrite}
                        disabled={rewrite.isPending}
                        className="rounded-none border-border hover:bg-secondary"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" /> Retry
                      </Button>
                      <Button variant="ghost" onClick={discardPreview} className="rounded-none text-muted-foreground">
                        Dismiss
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Discussion coverage */}
        <div className="border-t border-border pt-6">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="font-serif text-lg">Discussion coverage</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-5 print:hidden">
            A prompt for what a complete meeting touches. Mark what you covered — then enhance the draft so
            nothing falls through the cracks.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
            {coverageDimensions.map((dim) => {
              const entry = effective.coverage[dim.id];
              const selected = entry?.value ?? dim.options[0].value;
              const covered = isCovered(selected);
              const showDetail = covered && !!entry;
              const Icon = dim.icon;
              return (
                <div
                  key={dim.id}
                  className={cn(
                    "border border-border bg-background flex overflow-hidden transition-colors",
                    showDetail && "border-l-0",
                  )}
                >
                  <div className={cn("w-1 shrink-0", showDetail ? dim.accent.bar : "bg-transparent")} />
                  <div className="flex-1 p-4 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center justify-center w-7 h-7 border", dim.accent.chip)}>
                        <Icon className={cn("w-4 h-4", dim.accent.icon)} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold leading-tight">{dim.label}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{dim.hint}</p>
                    <Select
                      value={selected}
                      onValueChange={(v) =>
                        setCoverage(dim.id, { value: v, detail: isCovered(v) ? entry?.detail ?? "" : "" })
                      }
                    >
                      <SelectTrigger className="h-9 rounded-none border-border bg-card text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none">
                        {dim.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {showDetail && (
                      <Textarea
                        value={entry?.detail ?? ""}
                        onChange={(e) => setCoverage(dim.id, { value: selected, detail: e.target.value })}
                        placeholder="Add further detail…"
                        className="min-h-[64px] rounded-none border-border bg-card text-sm focus-visible:ring-primary"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Print-only coverage summary */}
          <div className="hidden print:block">
            {coveredForPrint.length === 0 ? (
              <p className="text-sm text-muted-foreground">No specific discussion topics recorded.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {coveredForPrint.map(({ dim, entry }) => (
                  <li key={dim.id}>
                    <strong>{dim.label}:</strong> {entry?.value}
                    {entry?.detail ? ` — ${entry.detail}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 print:hidden">
            <Button
              onClick={runEnhance}
              disabled={!hasNote || !hasCoverage || rewrite.isPending}
              variant="outline"
              className="rounded-none border-primary/40 text-primary hover:bg-primary/5"
            >
              {rewrite.isPending && previewMode === "enhance" ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enhancing...</>
              ) : (
                <><Wand2 className="w-4 h-4 mr-2" /> Enhance note with these details</>
              )}
            </Button>
            {!hasNote ? (
              <span className="text-xs text-muted-foreground">Write a note first, then enhance it with your coverage.</span>
            ) : !hasCoverage ? (
              <span className="text-xs text-muted-foreground">Mark at least one topic above to weave into the note.</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
