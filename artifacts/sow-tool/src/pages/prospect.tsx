import { useEffect, useRef, useState, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProspect,
  useUpdateProspect,
  useDeleteProspect,
  getGetProspectQueryKey,
  getListProspectsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { FileNotePanel } from "@/components/file-note-panel";
import { ProspectPrepPanel, ApproachSection } from "@/components/prospect-prep-panel";
import { JourneyRail, StepSection, type JourneyStep } from "@/components/journey-rail";
import { ReferralPointers } from "@/components/referral-pointers";
import { MeetingFactFind } from "@/components/meeting-fact-find";
import { SourceOfWealthSection } from "@/components/source-of-wealth-section";
import { CorroborationDocuments, type CorroborationData } from "@/components/corroboration-documents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { sowStatementFields } from "@/lib/sowCatalog";
import {
  Printer, Trash2, ChevronLeft, Save, AlertCircle, CheckCircle2,
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

  const [localData, setLocalData] = useState<Record<string, any>>({});
  const [localMeta, setLocalMeta] = useState({ status: "identified", segment: "", relationshipManager: "" });
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  // The briefing pack reads as one continuous document — every step is open by
  // default so the banker can scroll up and down and review the whole thing at
  // any point. A step can still be collapsed individually from its header.
  // `null` means "not yet customised" → treated as all-open below.
  const [openSteps, setOpenSteps] = useState<Set<string> | null>(null);

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

  // The prep pack is generated asynchronously by a background job and arrives
  // via a query refetch, not a user edit. The one-time init effect above won't
  // pick it up (already initialised for this id), so merge it in when it lands.
  // Without this the briefing only appears after a remount (navigate away and
  // back). Syncing latestData too keeps the debounced autosave from round-
  // tripping a data blob that's missing the freshly generated prep and wiping
  // it server-side. Other localData fields (in-flight banker edits) are kept.
  const serverPrep = (prospect?.data as Record<string, any> | undefined)?.prep;
  useEffect(() => {
    if (!serverPrep) return;
    setLocalData((prev) => {
      if (prev.prep === serverPrep) return prev;
      const next = { ...prev, prep: serverPrep };
      latestData.current = next;
      return next;
    });
  }, [serverPrep]);

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
  // An assessment may have been created by the legacy convert flow before the
  // Source of Wealth moved inline here; if so we surface a link to it for
  // continuity, but the live SoW work now happens on this page.
  const legacyAssessmentId =
    prospect.status === "converted" ? prospect.convertedAssessmentId ?? null : null;
  const prep = localData.prep as import("@workspace/research-pipeline/types").PrepPack | undefined;

  // ── Journey steps — one backbone, same on the assessment page. The four are
  // navigable anchors, not a progress tracker (no done/todo ticks). ──
  const hasPrep = !!prep;
  const approachUsed = Array.isArray(localData.approachUsage) && (localData.approachUsage as unknown[]).length > 0;
  const hasFileNote = !!(localData.fileNote as { note?: string } | undefined)?.note?.trim();
  const hasSowStatement = sowStatementFields.some(
    (f) => ((localData[f.id] as string | undefined) ?? "").trim().length > 0,
  );

  const steps: JourneyStep[] = [
    { key: "brief", label: "Brief & qualify" },
    { key: "approach", label: "Approach" },
    { key: "meeting", label: "Meeting" },
    { key: "sow", label: "Source of Wealth" },
  ];
  const isDormant = localMeta.status === "dormant";

  // Every step open by default so the pack reads as one continuous document.
  const open = openSteps ?? new Set(steps.map((s) => s.key));
  const isOpen = (key: string) => open.has(key);

  // Header chevron: collapse/expand a single step without affecting the others.
  const toggleStep = (key: string) => {
    const next = new Set(open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOpenSteps(next);
  };

  // Rail click: make sure the step is open, then scroll it into view so the
  // banker can jump anywhere in the pack and keep scrolling up and down.
  const selectStep = (key: string) => {
    if (!open.has(key)) {
      const next = new Set(open);
      next.add(key);
      setOpenSteps(next);
    }
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
            <div><strong>Status:</strong> {isDormant ? "Dormant" : "Active"}</div>
            <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Journey — one persistent rail + the steps below as a single
            continuous briefing pack: every step is open by default so the
            banker can review the whole thing and scroll up and down freely. The
            rail jumps to any step and highlights the next action; each step can
            still be collapsed from its own header. */}
        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12 min-w-0">
          <JourneyRail steps={steps} onSelect={selectStep} />

          <div className="space-y-4 min-w-0">
            {/* 1 · Brief & qualify — the researched read + the $25M qualifier. */}
            <StepSection
              id="step-brief"
              index={0}
              title="Brief & qualify"
              summary={hasPrep ? "Researched read + $25M qualifier" : "Generate the brief to qualify this prospect"}
              active={isOpen("brief")}
              onActivate={() => toggleStep("brief")}
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
              active={isOpen("approach")}
              onActivate={() => toggleStep("approach")}
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
              active={isOpen("meeting")}
              onActivate={() => toggleStep("meeting")}
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

            {/* 4 · Source of Wealth — open inline. The statement draws on the
                meeting note + briefing already captured above; no "convert"
                step in between. */}
            <StepSection
              id="step-sow"
              index={3}
              title="Source of Wealth"
              summary={hasSowStatement ? "Statement drafted" : "Draft the Source of Wealth statement"}
              active={isOpen("sow")}
              onActivate={() => toggleStep("sow")}
            >
              {legacyAssessmentId != null && (
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 mb-6 border border-border bg-secondary/30 print:hidden">
                  <p className="text-sm text-muted-foreground">
                    An earlier assessment was created for this prospect under the previous flow.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setLocation(`/assessment/${legacyAssessmentId}`)}
                    className="rounded-md shrink-0"
                  >
                    Open earlier assessment
                  </Button>
                </div>
              )}

              <SourceOfWealthSection
                data={{ ...localData, prospectBriefing: localData.prospectBriefing ?? briefing }}
                clientName={prospect.name}
                onFieldChange={handleDataChange}
                onApply={(values) => {
                  latestData.current = { ...latestData.current, ...values };
                  setLocalData(latestData.current);
                  scheduleSave();
                }}
              />

              <CorroborationDocuments
                key={id}
                clientName={prospect.name}
                value={localData["sow.corroboration"] as CorroborationData | undefined}
                onChange={(v) => handleDataChange("sow.corroboration", v)}
              />
            </StepSection>
          </div>
        </div>

      </div>
    </Layout>
  );
}
