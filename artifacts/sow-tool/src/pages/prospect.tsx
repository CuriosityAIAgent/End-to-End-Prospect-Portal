import { useEffect, useRef, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProspect,
  useUpdateProspect,
  useDeleteProspect,
  useGenerateProspectBriefing,
  useConvertProspect,
  getGetProspectQueryKey,
  getListProspectsQueryKey,
  getListAssessmentsQueryKey,
  getGetOverviewQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { FileNotePanel } from "@/components/file-note-panel";
import { ProspectPrepPanel, ApproachSection } from "@/components/prospect-prep-panel";
import { JourneyRail, StepSection, type JourneyStep, type StepStatus } from "@/components/journey-rail";
import { ReferralPointers } from "@/components/referral-pointers";
import { MeetingFactFind } from "@/components/meeting-fact-find";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { prospectingSections, prospectStatuses, prospectStatusLabel, coldCallScenarios, coldCallCapture, coldCallObjective, coldCallEmailReminder, coldCallDeliveryNotes } from "@/lib/prospectingCatalog";
import {
  Printer, Trash2, ChevronLeft, Save, AlertCircle, CheckCircle2, Sparkles,
  Compass, Users, ListChecks, ExternalLink, ArrowRightCircle, Loader2, Lightbulb, Route as RouteIcon, Phone,
} from "lucide-react";

export default function Prospect() {
  const [, params] = useRoute("/prospect/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const queryClient = useQueryClient();

  const { data: prospect, isLoading, error } = useGetProspect(id, {
    query: { enabled: !!id, queryKey: getGetProspectQueryKey(id) },
  });

  const updateProspect = useUpdateProspect();
  const deleteProspect = useDeleteProspect();
  const convertProspect = useConvertProspect();

  const [localData, setLocalData] = useState<Record<string, any>>({});
  const [localMeta, setLocalMeta] = useState({ status: "identified", segment: "", relationshipManager: "" });
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  // Which journey step is expanded. null = follow the computed current step.
  const [activeStep, setActiveStep] = useState<string | null>(null);

  const initializedForId = useRef<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  // Always-current copies of local state so the debounced save reads the latest
  // values rather than values captured in a stale render closure.
  const latestData = useRef<Record<string, any>>({});
  const latestMeta = useRef(localMeta);
  // Set once convert/delete starts so a queued autosave can't overwrite the
  // terminal state (e.g. regress status from "converted").
  const savesBlocked = useRef(false);

  useEffect(() => {
    if (prospect && initializedForId.current !== id) {
      initializedForId.current = id;
      const data = (prospect.data as Record<string, any>) || {};
      const meta = {
        status: prospect.status,
        segment: prospect.segment || "",
        relationshipManager: prospect.relationshipManager || "",
      };
      latestData.current = data;
      latestMeta.current = meta;
      savesBlocked.current = false;
      setLocalData(data);
      setLocalMeta(meta);
    }
  }, [prospect, id]);

  const cancelPendingSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
    }
  }, []);

  // Cancel any pending debounced save when leaving the page.
  useEffect(() => cancelPendingSave, [cancelPendingSave]);

  const scheduleSave = useCallback(() => {
    if (savesBlocked.current) return;
    setSaveStatus("saving");
    cancelPendingSave();
    saveTimeoutRef.current = setTimeout(() => {
      if (savesBlocked.current) return;
      updateProspect.mutate({
        id,
        data: {
          data: latestData.current,
          status: latestMeta.current.status as any,
          segment: latestMeta.current.segment || null,
          relationshipManager: latestMeta.current.relationshipManager || null,
        },
      }, {
        onSuccess: (updated) => {
          setSaveStatus("saved");
          queryClient.setQueryData(getGetProspectQueryKey(id), updated);
          queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey() });
        },
        onError: () => setSaveStatus("error"),
      });
    }, 1000);
  }, [id, updateProspect, queryClient, cancelPendingSave]);

  const handleDataChange = (key: string, value: any) => {
    latestData.current = { ...latestData.current, [key]: value };
    setLocalData(latestData.current);
    scheduleSave();
  };

  const handleMetaChange = (key: keyof typeof localMeta, value: string) => {
    latestMeta.current = { ...latestMeta.current, [key]: value };
    setLocalMeta(latestMeta.current);
    scheduleSave();
  };

  const handleConvert = () => {
    savesBlocked.current = true;
    cancelPendingSave();
    convertProspect.mutate({ id }, {
      onSuccess: (assessment) => {
        queryClient.invalidateQueries({ queryKey: getGetProspectQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
        setLocation(`/assessment/${assessment.id}`);
      },
      onError: () => {
        savesBlocked.current = false;
      },
    });
  };

  const handleDelete = () => {
    savesBlocked.current = true;
    cancelPendingSave();
    deleteProspect.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey() });
        setLocation("/");
      },
      onError: () => {
        savesBlocked.current = false;
      },
    });
  };

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-xl font-serif mb-2">Prospect not found</h2>
          <Button variant="outline" onClick={() => setLocation("/")}>Return to Pipeline</Button>
        </div>
      </Layout>
    );
  }

  if (isLoading || !prospect) {
    return (
      <Layout>
        <div className="animate-pulse space-y-8">
          <div className="h-12 w-1/3 bg-card border border-border" />
          <div className="h-[600px] w-full bg-card border border-border" />
        </div>
      </Layout>
    );
  }

  const briefing = prospect.briefing;
  const isConverted = prospect.status === "converted" && !!prospect.convertedAssessmentId;
  const prep = localData.prep as import("@workspace/research-pipeline/types").PrepPack | undefined;

  // ── Journey steps — one backbone, same on the post-convert page ──
  const hasPrep = !!prep;
  const approachUsed = Array.isArray(localData.approachUsage) && (localData.approachUsage as unknown[]).length > 0;
  const hasFileNote = !!(localData.fileNote as { note?: string } | undefined)?.note?.trim();

  const stepDefs = [
    { key: "brief", label: "Brief & qualify", done: hasPrep },
    { key: "approach", label: "Approach", done: approachUsed },
    { key: "meeting", label: "Meeting", done: hasFileNote },
    { key: "sow", label: "Source of Wealth", done: isConverted },
  ];
  const currentIdx = stepDefs.findIndex((s) => !s.done);
  const currentKey = stepDefs[currentIdx === -1 ? stepDefs.length - 1 : currentIdx].key;
  const currentStageLabel = stepDefs.find((s) => s.key === currentKey)?.label ?? "";
  const activeKey = activeStep ?? currentKey;
  const isDormant = localMeta.status === "dormant";

  const steps: JourneyStep[] = stepDefs.map((s) => ({
    key: s.key,
    label: s.label,
    status: (s.done ? "done" : s.key === activeKey ? "current" : "todo") as StepStatus,
  }));
  const statusOf = (key: string) => steps.find((s) => s.key === key)!.status;

  const selectStep = (key: string) => {
    // Toggle: clicking the open step collapses it back to nothing (no scroll).
    if (key === activeKey) {
      setActiveStep("__none__");
      return;
    }
    setActiveStep(key);
    // Let the section expand, then bring it into view (matters on mobile, where
    // the rail sits above the content).
    requestAnimationFrame(() =>
      document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto flex flex-col gap-8 pb-24 print:pb-0 min-w-0">

        {/* Header controls — not printed */}
        <div className="flex flex-col gap-4 print:hidden">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-muted-foreground -ml-3">
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                {saveStatus === "saving" ? (
                  <span className="text-muted-foreground flex items-center"><Save className="w-3 h-3 mr-1 animate-pulse" /> Saving...</span>
                ) : saveStatus === "error" ? (
                  <span className="text-destructive flex items-center"><AlertCircle className="w-3 h-3 mr-1" /> Save failed</span>
                ) : (
                  <span className="text-emerald-500 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Saved</span>
                )}
              </div>
              <div className="h-4 w-px bg-border mx-1" />
              <Button variant="outline" size="sm" onClick={() => window.print()} className="rounded-md border-border hover:bg-secondary">
                <Printer className="w-4 h-4 mr-2" /> Print Brief
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-md border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-md bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-serif">Delete Prospect?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove the prospect {prospect.name} and its briefing. This action cannot be undone.
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
                <h1 className="text-3xl font-serif text-foreground mb-2">{prospect.name}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  {/* Stage is shown by the Plan of action rail (not the legacy
                      status enum, which used a different vocabulary). */}
                  <span>Added {new Date(prospect.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex flex-col gap-4 min-w-[260px]">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Segment</label>
                  <Input
                    value={localMeta.segment}
                    onChange={(e) => handleMetaChange("segment", e.target.value)}
                    placeholder="e.g. PE Partner"
                    className="h-8 rounded-md border-border bg-background text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Banker</label>
                    <Input
                      value={localMeta.relationshipManager}
                      onChange={(e) => handleMetaChange("relationshipManager", e.target.value)}
                      placeholder="A. Banker"
                      className="h-8 rounded-md border-border bg-background text-sm"
                    />
                  </div>
                  {/* Stage itself is derived (shown by the Plan of action rail). The
                      only non-derived lifecycle state is whether the prospect is
                      parked, so we keep a focused Active/Dormant control — not the
                      old stage enum that contradicted the rail. */}
                  {localMeta.status !== "converted" && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                      <Select
                        value={isDormant ? "dormant" : "active"}
                        onValueChange={(v) => handleMetaChange("status", v === "dormant" ? "dormant" : "identified")}
                      >
                        <SelectTrigger className="h-8 rounded-md border-border bg-background text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-md">
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="dormant">Dormant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-8 pb-4 border-b border-border">
          <h1 className="text-3xl font-serif mb-2">Prospecting Brief</h1>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Prospect:</strong> {prospect.name}</div>
            <div><strong>Segment:</strong> {localMeta.segment || "N/A"}</div>
            <div><strong>Banker:</strong> {localMeta.relationshipManager || "N/A"}</div>
            <div><strong>Stage:</strong> {isDormant ? "Dormant" : currentStageLabel}</div>
            <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Journey — one persistent rail + a step accordion. The page reads
            top-to-bottom with a clear sense of where the prospect sits and only
            one step open at a time (others stay mounted, so a running prep or an
            unsaved note survives). The same rail renders on the assessment page. */}
        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 min-w-0">
          <JourneyRail steps={steps} activeKey={activeKey} onSelect={selectStep} />

          <div className="space-y-4 min-w-0">
            {/* 1 · Brief & qualify — the researched read + the $25M qualifier. */}
            <StepSection
              id="step-brief"
              index={0}
              title="Brief & qualify"
              summary={hasPrep ? "Researched read + $25M qualifier" : "Generate the brief to qualify this prospect"}
              status={statusOf("brief")}
              active={activeKey === "brief"}
              onActivate={() => selectStep("brief")}
            >
              <ProspectPrepPanel
                prospectId={id}
                prospectName={prospect.name}
                prep={prep}
                industry={localData.industry as string | undefined}
                knownInfo={localData.knownInfo as string | undefined}
                onFieldChange={handleDataChange}
                view="brief"
              />
            </StepSection>

            {/* 2 · Approach — warm route first, else a cold email/call for a meeting. */}
            <StepSection
              id="step-approach"
              index={1}
              title="Approach"
              summary={approachUsed ? "Outreach underway" : "Reach out — referral first, then cold"}
              status={statusOf("approach")}
              active={activeKey === "approach"}
              onActivate={() => selectStep("approach")}
            >
              {prep ? (
                <div className="space-y-8">
                  <ApproachSection
                    approach={prep.approach}
                    fallback={prep.coldCall}
                    onCopyVariant={(channel, variantId, label) => {
                      // Lightweight learning: append which outreach variant the banker
                      // copies. Read the live ref (not render-captured localData) so two
                      // quick copies don't clobber each other.
                      const log = Array.isArray(latestData.current.approachUsage)
                        ? (latestData.current.approachUsage as unknown[])
                        : [];
                      handleDataChange("approachUsage", [
                        ...log,
                        { channel, variantId, label, action: "copied", at: new Date().toISOString() },
                      ]);
                    }}
                  />
                  <ReferralPointers
                    prospectName={prospect.name}
                    segment={localMeta.segment}
                    referralRoutes={(briefing as { referralRoutes?: string[] } | undefined)?.referralRoutes}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Generate the brief first — it drafts the outreach (email, call and likely pushback).
                </p>
              )}
            </StepSection>

            {/* 3 · Meeting — what to collect, then the note that feeds the SoW. */}
            <StepSection
              id="step-meeting"
              index={2}
              title="Meeting"
              summary={hasFileNote ? "Meeting note captured" : "Collect the fact-find, then write the note"}
              status={statusOf("meeting")}
              active={activeKey === "meeting"}
              onActivate={() => selectStep("meeting")}
            >
              <div className="space-y-8">
                <MeetingFactFind prep={prep} />
                <FileNotePanel
                  value={localData.fileNote}
                  onChange={(v) => handleDataChange("fileNote", v)}
                  contactName={prospect.name}
                  defaultMeetingType="Prospect first meeting"
                />
              </div>
            </StepSection>

            {/* 4 · Source of Wealth — convert to build the assessment. */}
            <StepSection
              id="step-sow"
              index={3}
              title="Source of Wealth"
              summary={isConverted ? "Assessment created" : "Convert to build the Source of Wealth"}
              status={statusOf("sow")}
              active={activeKey === "sow"}
              onActivate={() => selectStep("sow")}
            >
              {isConverted ? (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border border-emerald-500/20 bg-emerald-500/5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                    <div>
                      <p className="font-medium">This prospect has been converted to a client.</p>
                      <p className="text-sm text-muted-foreground">A Source of Wealth assessment was created, carrying over the captured profile and briefing.</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setLocation(`/assessment/${prospect.convertedAssessmentId}`)}
                    className="rounded-md bg-primary text-primary-foreground shrink-0"
                  >
                    Open Assessment
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border border-border bg-card">
                  <div>
                    <p className="font-medium">Ready to onboard this prospect?</p>
                    <p className="text-sm text-muted-foreground">
                      Create a Source of Wealth assessment. The prospect profile and AI briefing are carried over for continuity.
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="rounded-md bg-primary text-primary-foreground shrink-0" disabled={convertProspect.isPending}>
                        {convertProspect.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Converting...</>
                        ) : (
                          <><ArrowRightCircle className="w-4 h-4 mr-2" /> Convert to Client</>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-md bg-card border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-serif">Convert {prospect.name} to a client?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This creates a new Source of Wealth assessment and marks the prospect as converted. You'll be taken to the new assessment.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-md">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConvert} className="rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                          Convert
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </StepSection>
          </div>
        </div>

      </div>
    </Layout>
  );
}
