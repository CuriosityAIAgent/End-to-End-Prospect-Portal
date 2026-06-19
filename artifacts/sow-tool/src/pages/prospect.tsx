import { useEffect, useRef, useState, useCallback, ReactNode } from "react";
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
import { ProspectPrepPanel } from "@/components/prospect-prep-panel";
import { SectionInfo } from "@/components/section-info";
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
        setLocation("/prospecting");
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
          <Button variant="outline" onClick={() => setLocation("/prospecting")}>Return to Pipeline</Button>
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

  const sectionIcon = (sectionId: string) => {
    if (sectionId === "profile") return <Users className="w-5 h-5" />;
    if (sectionId === "channels") return <RouteIcon className="w-5 h-5" />;
    return <ListChecks className="w-5 h-5" />;
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-24 print:pb-0">

        {/* Header controls — not printed */}
        <div className="flex flex-col gap-4 print:hidden">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/prospecting")} className="text-muted-foreground -ml-3">
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
                  <span className="uppercase tracking-wider font-semibold text-[10px] px-2 py-0.5 border border-border bg-secondary">
                    {prospectStatusLabel(prospect.status)}
                  </span>
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
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stage</label>
                    <Select value={localMeta.status} onValueChange={(v) => handleMetaChange("status", v)}>
                      <SelectTrigger className="h-8 rounded-md border-border bg-background text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        {prospectStatuses.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">RM</label>
                    <Input
                      value={localMeta.relationshipManager}
                      onChange={(e) => handleMetaChange("relationshipManager", e.target.value)}
                      placeholder="A. Banker"
                      className="h-8 rounded-md border-border bg-background text-sm"
                    />
                  </div>
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
            <div><strong>Relationship Manager:</strong> {localMeta.relationshipManager || "N/A"}</div>
            <div><strong>Stage:</strong> {prospectStatusLabel(localMeta.status)}</div>
            <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* The prep — one researched, verified output: the read, the approach
            (cold-call + likely pushback), and the Source-of-Wealth questions. */}
        <ProspectPrepPanel
          prospectId={id}
          prospectName={prospect.name}
          prep={localData.prep as import("@workspace/research-pipeline/types").PrepPack | undefined}
          industry={localData.industry as string | undefined}
          knownInfo={localData.knownInfo as string | undefined}
          onFieldChange={handleDataChange}
        />

        {/* Meeting note — captured after the meeting; feeds the SoW file on convert. */}
        <FileNotePanel
          value={localData.fileNote}
          onChange={(v) => handleDataChange("fileNote", v)}
          contactName={prospect.name}
          defaultMeetingType="Prospect first meeting"
        />

        {/* Convert */}
        <div className="print:hidden border-t border-border pt-8">
          <Section title="Convert to Client" icon={<ArrowRightCircle className="w-5 h-5" />} helpId="prospect.convert">
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
          </Section>
        </div>

      </div>
    </Layout>
  );
}

function Section({ title, icon, children, helpId }: { title: string; icon: ReactNode; children: ReactNode; helpId?: string }) {
  return (
    <section className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-6 pb-3 border-b border-border">
        <span className="text-primary">{icon}</span>
        <h2 className="text-2xl font-serif">{title}</h2>
        {helpId && <SectionInfo id={helpId} className="ml-1" />}
      </div>
      {children}
    </section>
  );
}
