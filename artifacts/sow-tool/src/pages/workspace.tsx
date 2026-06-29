import { useEffect, useRef, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAssessment,
  useUpdateAssessment,
  useDeleteAssessment,
  getGetAssessmentQueryKey,
  getListAssessmentsQueryKey,
  getGetOverviewQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { FileNotePanel } from "@/components/file-note-panel";
import { SourceOfWealthSection } from "@/components/source-of-wealth-section";
import { CorroborationDocuments, type CorroborationData } from "@/components/corroboration-documents";
import { JourneyRail, StepSection, type JourneyStep, type StepStatus } from "@/components/journey-rail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateProgress } from "@/lib/progress";
import {
  statusOptions, riskRatingOptions, reviewTypeOptions,
  wealthCategories, sourceOfFundsQuestions, sourceOfFundsDocuments,
  plausibilityChecks, redFlags, signOffFields,
} from "@/lib/sowCatalog";
import {
  Printer, Trash2, ChevronLeft, Save, AlertCircle, CheckCircle2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";

export default function Workspace() {
  const [, params] = useRoute("/assessment/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const queryClient = useQueryClient();

  const { data: assessment, isLoading, error } = useGetAssessment(id, {
    query: { enabled: !!id, queryKey: getGetAssessmentQueryKey(id) }
  });

  const updateAssessment = useUpdateAssessment();
  const deleteAssessment = useDeleteAssessment();

  // Local state for debounced saves
  const [localData, setLocalData] = useState<Record<string, any>>({});
  const [localMeta, setLocalMeta] = useState({
    status: "draft",
    riskRating: "standard",
    clientReference: "",
    relationshipManager: ""
  });

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  // Which journey step is expanded. null = default to Source of Wealth.
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const initializedForId = useRef<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Init local state when data loads
  useEffect(() => {
    if (assessment && initializedForId.current !== id) {
      initializedForId.current = id;
      setLocalData(assessment.data || {});
      setLocalMeta({
        status: assessment.status,
        riskRating: assessment.riskRating || "standard",
        clientReference: assessment.clientReference || "",
        relationshipManager: assessment.relationshipManager || ""
      });
    }
  }, [assessment, id]);

  const triggerSave = useCallback((newData: Record<string, any>, newMeta: typeof localMeta) => {
    setSaveStatus("saving");

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(() => {
      updateAssessment.mutate({
        id,
        data: {
          data: newData,
          status: newMeta.status as any,
          riskRating: newMeta.riskRating as any,
          clientReference: newMeta.clientReference,
          relationshipManager: newMeta.relationshipManager
        }
      }, {
        onSuccess: (updated) => {
          setSaveStatus("saved");
          // Patch cache locally to avoid full refetch that could clobber ongoing typing
          queryClient.setQueryData(getGetAssessmentQueryKey(id), updated);
          // Invalidate lists in background
          queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
        },
        onError: () => {
          setSaveStatus("error");
        }
      });
    }, 1000);
  }, [id, updateAssessment, queryClient]);

  const handleDataChange = (key: string, value: any) => {
    setLocalData(prev => {
      const next = { ...prev, [key]: value };
      triggerSave(next, localMeta);
      return next;
    });
  };

  const handleMetaChange = (key: keyof typeof localMeta, value: string) => {
    setLocalMeta(prev => {
      const next = { ...prev, [key]: value };
      triggerSave(localData, next);
      return next;
    });
  };

  const handleDelete = () => {
    deleteAssessment.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
        setLocation("/");
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-xl font-serif mb-2">Assessment not found</h2>
          <Button variant="outline" onClick={() => setLocation("/")}>Return to Journey</Button>
        </div>
      </Layout>
    );
  }

  if (isLoading || !assessment) {
    return (
      <Layout>
        <div className="animate-pulse space-y-8">
          <div className="h-12 w-1/3 bg-card border border-border"></div>
          <div className="h-[600px] w-full bg-card border border-border"></div>
        </div>
      </Layout>
    );
  }

  const progress = calculateProgress(localData, { complete: localMeta.status === "completed" });

  // ── Journey steps — same backbone as the prospect page. Brief & Approach
  // happened pre-convert (they live on the prospect record), so they show as
  // done context here; Meeting and Source of Wealth are the live steps. ──
  const hasFileNote = !!(localData.fileNote as { note?: string } | undefined)?.note?.trim();
  const isComplete = localMeta.status === "completed";
  // A converted assessment carries the prospect's profile across (data.prospectProfile);
  // an assessment created directly from the Journey page does not — so don't claim
  // the pre-convert steps were done for standalone assessments.
  const fromProspect = !!localData.prospectProfile;
  const preStatus: StepStatus = fromProspect ? "done" : "todo";
  // A completed assessment is fully done even if it predates the file-note step.
  const meetingDone = hasFileNote || isComplete;
  // Open on the first live step that still needs work (meeting note before statement).
  const activeKey = activeStep ?? (meetingDone ? "sow" : "meeting");

  const steps: JourneyStep[] = [
    { key: "brief", label: "Brief & qualify", status: preStatus, disabled: true },
    { key: "approach", label: "Approach", status: preStatus, disabled: true },
    { key: "meeting", label: "Meeting", status: meetingDone ? "done" : activeKey === "meeting" ? "current" : "todo" },
    { key: "sow", label: "Source of Wealth", status: isComplete ? "done" : activeKey === "sow" ? "current" : "todo" },
  ];
  const statusOf = (key: string) => steps.find((s) => s.key === key)!.status;

  const selectStep = (key: string) => {
    // Brief & Approach are context-only on this page (disabled in the rail).
    if (key !== "meeting" && key !== "sow") return;
    setActiveStep(key);
    requestAnimationFrame(() =>
      document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-24 print:pb-0 min-w-0">

        {/* Workspace Header - Not printed */}
        <div className="flex flex-col gap-4 print:hidden">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-muted-foreground -ml-3">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                {saveStatus === 'saving' ? (
                  <span className="text-muted-foreground flex items-center"><Save className="w-3 h-3 mr-1 animate-pulse" /> Saving...</span>
                ) : saveStatus === 'error' ? (
                  <span className="text-destructive flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> Save failed</span>
                ) : (
                  <span className="text-emerald-500 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Saved</span>
                )}
              </div>
              <div className="h-4 w-px bg-border mx-1"></div>
              <Button variant="outline" size="sm" onClick={handlePrint} className="rounded-md border-border hover:bg-secondary">
                <Printer className="w-4 h-4 mr-2" /> Export / Print
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-md border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-md bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif">Delete Assessment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the assessment for {assessment.clientName}. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-md">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          <div className="bg-card border border-border p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
              <div>
                <h1 className="text-3xl font-serif text-foreground mb-2">{assessment.clientName}</h1>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="uppercase tracking-wider font-semibold text-[10px] px-2 py-0.5 border border-border bg-secondary">
                    {reviewTypeOptions.find(o => o.value === assessment.reviewType)?.label}
                  </span>
                  <span>Created {new Date(assessment.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4 min-w-[250px]">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                    <Select value={localMeta.status} onValueChange={(v) => handleMetaChange('status', v)}>
                      <SelectTrigger className="h-8 rounded-md border-border bg-background text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        {statusOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Risk</label>
                    <Select value={localMeta.riskRating} onValueChange={(v) => handleMetaChange('riskRating', v)}>
                      <SelectTrigger className="h-8 rounded-md border-border bg-background text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        {riskRatingOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Completion</span>
                    <span>{progress.percentage}%</span>
                  </div>
                  <Progress value={progress.percentage} className="h-1 rounded-md bg-secondary [&>div]:bg-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Print Header - Only visible when printing */}
        <div className="hidden print:block mb-8 pb-4 border-b border-border">
          <h1 className="text-3xl font-serif mb-2">Source of Wealth Assessment</h1>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Client:</strong> {assessment.clientName}</div>
            <div><strong>Reference:</strong> {localMeta.clientReference || 'N/A'}</div>
            <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
            <div><strong>Risk Rating:</strong> {riskRatingOptions.find(o => o.value === localMeta.riskRating)?.label}</div>
            <div><strong>Review Type:</strong> {reviewTypeOptions.find(o => o.value === assessment.reviewType)?.label}</div>
            <div><strong>Status:</strong> {statusOptions.find(o => o.value === localMeta.status)?.label}</div>
          </div>
        </div>

        {/* Journey — same rail + accordion as the prospect page, so the flow is
            continuous across convert. Brief & Approach are done context; the
            live work here is the meeting note and the Source of Wealth statement. */}
        <div className="lg:grid lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-8 min-w-0">
          <JourneyRail steps={steps} activeKey={activeKey} onSelect={selectStep} />

          <div className="space-y-4 min-w-0">
            {/* 3 · Meeting — the note that the statement is drafted from. */}
            <StepSection
              id="step-meeting"
              index={2}
              title="Meeting"
              summary={hasFileNote ? "Meeting note captured" : "Add the meeting note the statement draws from"}
              status={statusOf("meeting")}
              active={activeKey === "meeting"}
              onActivate={() => selectStep("meeting")}
            >
              <FileNotePanel
                value={localData.fileNote}
                onChange={(v) => handleDataChange("fileNote", v)}
                contactName={assessment.clientName}
                defaultMeetingType="Client review"
              />
            </StepSection>

            {/* 4 · Source of Wealth — the statement that answers the onboarding
                questions. This is the page's job; everything else the bank's
                Connect tool already covers. */}
            <StepSection
              id="step-sow"
              index={3}
              title="Source of Wealth"
              summary={isComplete ? "Marked complete" : "Draft and confirm the statement"}
              status={statusOf("sow")}
              active={activeKey === "sow"}
              onActivate={() => selectStep("sow")}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Client reference</label>
                  <Input
                    value={localMeta.clientReference}
                    onChange={(e) => handleMetaChange('clientReference', e.target.value)}
                    className="rounded-md border-border bg-card"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Banker</label>
                  <Input
                    value={localMeta.relationshipManager}
                    onChange={(e) => handleMetaChange('relationshipManager', e.target.value)}
                    className="rounded-md border-border bg-card"
                  />
                </div>
              </div>

              <SourceOfWealthSection
                data={localData}
                clientName={assessment.clientName}
                onFieldChange={handleDataChange}
                onApply={(values) =>
                  setLocalData((prev) => {
                    const next = { ...prev, ...values };
                    triggerSave(next, localMeta);
                    return next;
                  })
                }
              />

              <CorroborationDocuments
                key={id}
                clientName={assessment.clientName}
                value={localData["sow.corroboration"] as CorroborationData | undefined}
                onChange={(v) => handleDataChange("sow.corroboration", v)}
              />

              <div className="pt-8 mt-8 border-t border-border flex justify-end print:hidden">
                <Button
                  onClick={() => handleMetaChange("status", "completed")}
                  className="rounded-md bg-primary text-primary-foreground"
                  disabled={isComplete}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Assessment as Completed
                </Button>
              </div>
            </StepSection>

            {/* Read-only archive of anything captured under the old, retired
                sections (categories / source of funds / plausibility / red flags
                / sign-off). Only shows for legacy assessments — nothing is lost. */}
            <LegacyDetails data={localData} />
          </div>
        </div>
      </div>
    </Layout>
  );
}

const DOC_STATE_LABEL: Record<string, string> = {
  pending: "Pending",
  provided: "Provided & Verified",
  waived: "Waived",
  na: "Not Applicable",
};

/** Collect any values stored under the retired due-diligence sections. */
function legacyEntries(data: Record<string, any>): { group: string; label: string; value: string }[] {
  const out: { group: string; label: string; value: string }[] = [];
  const push = (group: string, label: string, raw: unknown) => {
    if (raw === undefined || raw === null || raw === "" || raw === false) return;
    const value =
      typeof raw === "boolean" ? "Yes" : DOC_STATE_LABEL[String(raw)] ?? String(raw);
    out.push({ group, label, value });
  };
  const applicable = (data.applicableCategories as string[]) || [];
  const applicableNames = wealthCategories.filter((c) => applicable.includes(c.id)).map((c) => c.name);
  if (applicableNames.length) push("Wealth Categories", "Categories marked applicable", applicableNames.join(", "));
  // Only surface answers for categories the banker actually kept applicable —
  // deselecting a category in the old editor left its nested answers behind, and
  // showing that stale data would misrepresent the final assessment.
  wealthCategories.forEach((cat) => {
    if (!applicable.includes(cat.id)) return;
    cat.questions.forEach((q) => push(cat.name, q.label, data[q.id]));
    cat.documents.forEach((d) => push(cat.name, d.label, data[d.id]));
  });
  sourceOfFundsQuestions.forEach((q) => push("Source of Funds", q.label, data[q.id]));
  sourceOfFundsDocuments.forEach((d) => push("Source of Funds", d.label, data[d.id]));
  plausibilityChecks.forEach((c) => push("Plausibility & Corroboration", c.label, data[c.id]));
  redFlags.forEach((f) => push("Red Flags & Escalation", f.label, data[f.id]));
  push("Red Flags & Escalation", "Details / mitigation", data["flags.mitigation"]);
  signOffFields.forEach((f) => push("Assessment & Sign-off", f.label, data[f.id]));
  return out;
}

function LegacyDetails({ data }: { data: Record<string, any> }) {
  const [open, setOpen] = useState(false);
  const entries = legacyEntries(data);
  if (entries.length === 0) return null;

  const groups = entries.reduce<Record<string, { label: string; value: string }[]>>((acc, e) => {
    (acc[e.group] ||= []).push({ label: e.label, value: e.value });
    return acc;
  }, {});

  return (
    <section className="border border-border bg-secondary/20 scroll-mt-24 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-secondary/40 transition-colors print:hover:bg-transparent"
      >
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-serif leading-tight text-muted-foreground">Archived due-diligence (read-only)</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"} captured under the retired sections — kept for the record; the bank's Connect tool now owns this.
          </p>
        </div>
      </button>
      <div className={open ? "block" : "hidden print:block"}>
        <div className="px-5 pb-6 pt-1 border-t border-border space-y-6 min-w-0">
          {Object.entries(groups).map(([group, rows]) => (
            <div key={group} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</h3>
              <dl className="space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 border-b border-border/60 pb-2">
                    <dt className="text-sm text-foreground/90">{r.label}</dt>
                    <dd className="text-sm text-muted-foreground md:text-right whitespace-pre-wrap">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
