import { useState } from "react";
import { useRewriteFileNote, useExtractFileNoteProfile } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  coverageDimensions,
  meetingTypes,
  isCovered,
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
  UserPlus,
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
  profileExtraction,
}: {
  value: FileNoteData | undefined;
  onChange: (next: FileNoteData) => void;
  contactName: string;
  defaultMeetingType?: string;
  /**
   * When provided (assessment workspace only), shows a "Populate client profile"
   * action that extracts profile field values from the note. The prospect page
   * omits this — it has no client-profile form.
   */
  profileExtraction?: {
    fields: { key: string; label: string }[];
    currentValues: Record<string, string>;
    onApply: (values: Record<string, string>) => void;
  };
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
  const extractProfile = useExtractFileNoteProfile();

  const [profileResult, setProfileResult] = useState<{ key: string; value: string }[] | null>(null);
  const [profileSelected, setProfileSelected] = useState<Record<string, boolean>>({});
  const [profileError, setProfileError] = useState<string | null>(null);

  const words = countWords(effective.note);
  const hasNote = effective.note.trim().length > 0;
  const hasCoverage = coverageDimensions.some((dim) => {
    const entry = effective.coverage[dim.id];
    return !!entry && isCovered(entry.value);
  });

  // Only the dimensions the banker explicitly engaged with and whose value is
  // non-null. Shared by enhance and profile-extract — sending an untouched
  // default (e.g. Relationship Temperature's "Strong and growing") would feed
  // the model an unconfirmed "fact" it would weave in as if confirmed.
  const engagedCoverage = () =>
    coverageDimensions
      .map((dim) => ({ dim, entry: effective.coverage[dim.id] }))
      .filter(({ entry }) => !!entry && isCovered(entry.value))
      .map(({ dim, entry }) => ({ label: dim.label, value: entry!.value, detail: entry!.detail }));

  const fieldLabels = new Map(profileExtraction?.fields.map((f) => [f.key, f.label]) ?? []);

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
    const coverage = engagedCoverage();
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

  const runExtractProfile = () => {
    if (!profileExtraction) return;
    setProfileError(null);
    setProfileResult(null);
    extractProfile.mutate(
      {
        data: {
          note: effective.note,
          coverage: engagedCoverage(),
          fields: profileExtraction.fields,
        },
      },
      {
        onSuccess: (res) => {
          setProfileResult(res.values);
          // Default-tick fields that are currently empty; leave fields that
          // would overwrite the banker's existing input unticked so applying is
          // an opt-in, never a silent clobber.
          const sel: Record<string, boolean> = {};
          for (const v of res.values) {
            const current = profileExtraction.currentValues[v.key] ?? "";
            sel[v.key] = current.trim().length === 0;
          }
          setProfileSelected(sel);
        },
        onError: () => setProfileError("The client profile could not be extracted. Please try again."),
      },
    );
  };

  const applyExtractedProfile = () => {
    if (!profileExtraction || !profileResult) return;
    const chosen: Record<string, string> = {};
    for (const v of profileResult) {
      if (profileSelected[v.key]) chosen[v.key] = v.value;
    }
    if (Object.keys(chosen).length > 0) profileExtraction.onApply(chosen);
    setProfileResult(null);
    setProfileSelected({});
  };

  const dismissProfile = () => {
    setProfileResult(null);
    setProfileSelected({});
    setProfileError(null);
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

        {/* Populate client profile — assessment workspace only */}
        {profileExtraction && (
          <div className="border-t border-border pt-6 print:hidden">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="w-4 h-4 text-primary" />
              <h3 className="font-serif text-lg">Populate client profile</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Pull what you discussed straight into the client profile above. The assistant only
              suggests fields the note clearly covers — review and choose what to apply.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={runExtractProfile}
                disabled={!hasNote || extractProfile.isPending}
                variant="outline"
                className="rounded-none border-primary/40 text-primary hover:bg-primary/5"
              >
                {extractProfile.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Reading the note...</>
                ) : (
                  <><UserPlus className="w-4 h-4 mr-2" /> Populate profile from note</>
                )}
              </Button>
              {!hasNote && (
                <span className="text-xs text-muted-foreground">Write a note first.</span>
              )}
            </div>

            {profileError && (
              <div className="flex items-center gap-2 text-sm text-destructive mt-3">
                <AlertCircle className="w-4 h-4" /> {profileError}
              </div>
            )}

            {profileResult !== null && (
              <div className="border border-primary/30 bg-primary/[0.03] mt-4">
                <div className="px-4 py-2.5 border-b border-border bg-primary/5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                    <UserPlus className="w-3.5 h-3.5" /> Suggested profile details
                  </span>
                </div>
                <div className="p-4">
                  {profileResult.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing in the note mapped to a client-profile field. Add more detail and try again.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {profileResult.map((v) => {
                          const current = profileExtraction.currentValues[v.key] ?? "";
                          const willOverwrite = current.trim().length > 0;
                          return (
                            <label key={v.key} className="flex gap-3 items-start cursor-pointer">
                              <Checkbox
                                checked={!!profileSelected[v.key]}
                                onCheckedChange={(c) =>
                                  setProfileSelected((prev) => ({ ...prev, [v.key]: c === true }))
                                }
                                className="mt-0.5 rounded-none"
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-foreground/80">
                                    {fieldLabels.get(v.key) ?? v.key}
                                  </span>
                                  {willOverwrite && (
                                    <span className="text-[10px] uppercase tracking-wider text-amber-600 border border-amber-300 px-1.5 py-0.5">
                                      Overwrites existing
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{v.value}</p>
                                {willOverwrite && (
                                  <p className="text-xs text-muted-foreground line-through whitespace-pre-wrap">{current}</p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
                        <Button
                          onClick={applyExtractedProfile}
                          disabled={!profileResult.some((v) => profileSelected[v.key])}
                          className="rounded-none bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          <Check className="w-4 h-4 mr-2" /> Apply to profile
                        </Button>
                        <Button variant="ghost" onClick={dismissProfile} className="rounded-none text-muted-foreground">
                          Dismiss
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
