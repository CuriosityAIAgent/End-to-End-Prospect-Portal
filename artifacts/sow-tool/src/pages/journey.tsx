import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProspects,
  useListAssessments,
  useGetOverview,
  useCreateProspect,
  useCreateAssessment,
  getListProspectsQueryKey,
  getListAssessmentsQueryKey,
  getGetOverviewQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { OverviewVideo } from "@/components/overview-video";
import { SectionInfo } from "@/components/section-info";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { reviewTypeOptions, riskRatingOptions } from "@/lib/sowCatalog";
import {
  buildJourney,
  stageCounts,
  JOURNEY_STAGES,
  type JourneyStageId,
  type JourneyItem,
} from "@/lib/journey";
import {
  Search,
  Phone,
  FileText,
  Users,
  ShieldCheck,
  ArrowRight,
  Clock,
  AlertTriangle,
  Plus,
  UserPlus,
  Compass,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const STAGE_ICONS: Record<JourneyStageId, LucideIcon> = {
  identify: Search,
  cold_call: Phone,
  brief: FileText,
  meet: Users,
  onboard: ShieldCheck,
};

type StageFilter = JourneyStageId | "all";

export default function Journey() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: prospects, isLoading: prospectsLoading } = useListProspects();
  const { data: assessments, isLoading: assessmentsLoading } = useListAssessments();
  const { data: overview } = useGetOverview();

  const isLoading = prospectsLoading || assessmentsLoading;

  const items = useMemo(
    () => buildJourney(prospects ?? [], assessments ?? []),
    [prospects, assessments],
  );
  const counts = useMemo(() => stageCounts(items), [items]);

  const [filter, setFilter] = useState<StageFilter>("all");
  // Dormant relationships are excluded from the stage rail counts, so when a
  // specific stage is selected we hide them too (keeping the visible list in
  // step with the count). They remain visible, de-emphasised, under "All Stages".
  const filtered =
    filter === "all" ? items : items.filter((i) => i.stage === filter && !i.dormant);

  const activeCount = items.filter((i) => !i.dormant).length;
  const prospectCount = items.filter((i) => i.kind === "prospect" && !i.dormant).length;
  const onboardingCount = items.filter((i) => i.kind === "assessment").length;
  const enhancedCount = overview?.byRisk.find((r) => r.riskRating === "enhanced")?.count ?? 0;
  const signedOffCount = overview?.byStatus.find((s) => s.status === "completed")?.count ?? 0;

  const metrics = [
    { label: "Active Pipeline", value: activeCount },
    { label: "Prospects", value: prospectCount },
    { label: "In Onboarding", value: onboardingCount },
    { label: "Enhanced DD", value: enhancedCount },
    { label: "Signed Off", value: signedOffCount },
  ];

  // Add Prospect dialog
  const createProspect = useCreateProspect();
  const [isProspectOpen, setIsProspectOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pSegment, setPSegment] = useState("");
  const [pRm, setPRm] = useState("");

  const handleCreateProspect = () => {
    if (!pName.trim()) return;
    createProspect.mutate(
      {
        data: {
          name: pName.trim(),
          segment: pSegment.trim() || null,
          relationshipManager: pRm.trim() || null,
          status: "identified",
          data: {},
        },
      },
      {
        onSuccess: (created) => {
          setIsProspectOpen(false);
          setPName("");
          setPSegment("");
          setPRm("");
          queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey() });
          setLocation(`/prospect/${created.id}`);
        },
      },
    );
  };

  // New Assessment dialog
  const createAssessment = useCreateAssessment();
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [aName, setAName] = useState("");
  const [aReviewType, setAReviewType] = useState<string>("onboarding");
  const [aRiskRating, setARiskRating] = useState<string>("standard");

  const handleCreateAssessment = () => {
    if (!aName.trim()) return;
    createAssessment.mutate(
      {
        data: {
          clientName: aName.trim(),
          reviewType: aReviewType as never,
          riskRating: aRiskRating as never,
          status: "draft",
          data: {},
        },
      },
      {
        onSuccess: (created) => {
          setIsAssessmentOpen(false);
          setAName("");
          queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
          setLocation(`/assessment/${created.id}`);
        },
      },
    );
  };

  const hasAnything = items.length > 0;

  return (
    <Layout>
      <div className="flex flex-col gap-10 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-4xl font-serif text-foreground">Prospecting Journey</h1>
              <SectionInfo id="journey" />
            </div>
            <p className="text-muted-foreground">
              Every relationship, from first contact to onboarded client.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Dialog open={isAssessmentOpen} onOpenChange={setIsAssessmentOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="rounded-md border-border">
                  <UserPlus className="w-4 h-4 mr-2" />
                  New Assessment
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] rounded-md border-border bg-card">
                <DialogHeader>
                  <DialogTitle className="font-serif text-xl">Create Assessment</DialogTitle>
                  <DialogDescription>
                    Start a Source of Wealth file directly, for a client who skips the prospecting funnel.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="a-name" className="text-sm font-medium">Client Name</label>
                    <Input
                      id="a-name"
                      value={aName}
                      onChange={(e) => setAName(e.target.value)}
                      className="rounded-md bg-background border-border"
                      placeholder="e.g. John Doe or Acme Corp"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Review Type</label>
                    <Select value={aReviewType} onValueChange={setAReviewType}>
                      <SelectTrigger className="rounded-md bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        {reviewTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Risk Rating</label>
                    <Select value={aRiskRating} onValueChange={setARiskRating}>
                      <SelectTrigger className="rounded-md bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        {riskRatingOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAssessmentOpen(false)} className="rounded-md">Cancel</Button>
                  <Button
                    onClick={handleCreateAssessment}
                    disabled={!aName.trim() || createAssessment.isPending}
                    className="rounded-md bg-primary text-primary-foreground"
                  >
                    {createAssessment.isPending ? "Creating..." : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isProspectOpen} onOpenChange={setIsProspectOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shadow-md">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Prospect
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] rounded-md border-border bg-card">
                <DialogHeader>
                  <DialogTitle className="font-serif text-xl">Add Prospect</DialogTitle>
                  <DialogDescription>
                    Begin the journey — capture the name to start the cold-call and brief.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <label htmlFor="p-name" className="text-sm font-medium">Prospect Name</label>
                    <Input
                      id="p-name"
                      value={pName}
                      onChange={(e) => setPName(e.target.value)}
                      className="rounded-md bg-background border-border"
                      placeholder="e.g. Marcus Rourke"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="p-segment" className="text-sm font-medium">
                      Segment <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      id="p-segment"
                      value={pSegment}
                      onChange={(e) => setPSegment(e.target.value)}
                      className="rounded-md bg-background border-border"
                      placeholder="e.g. PE Partner, Founder, Family Office"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="p-rm" className="text-sm font-medium">
                      Relationship Manager <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      id="p-rm"
                      value={pRm}
                      onChange={(e) => setPRm(e.target.value)}
                      className="rounded-md bg-background border-border"
                      placeholder="e.g. A. Banker"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsProspectOpen(false)} className="rounded-md">Cancel</Button>
                  <Button
                    onClick={handleCreateProspect}
                    disabled={!pName.trim() || createProspect.isPending}
                    className="rounded-md bg-primary text-primary-foreground"
                  >
                    {createProspect.isPending ? "Adding..." : "Add Prospect"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Metrics band */}
        <div className="flex items-center gap-4 text-sm overflow-x-auto pb-1">
          {metrics.map((metric, i) => (
            <div key={metric.label} className="flex items-center gap-4 whitespace-nowrap">
              <div className="flex items-baseline gap-2">
                <span className="text-muted-foreground">{metric.label}</span>
                <span className="font-serif text-lg text-foreground">{metric.value}</span>
              </div>
              {i < metrics.length - 1 && <div className="w-1 h-1 rounded-full bg-border" />}
            </div>
          ))}
        </div>

        {/* Overview explainer video (hidden until a video is registered) */}
        <OverviewVideo />

        {/* Stage rail */}
        <section className="relative">
          <div className="absolute top-6 left-0 w-full h-px bg-border z-0" />
          <div className="relative z-10 grid grid-cols-5">
            {JOURNEY_STAGES.map((stage) => {
              const Icon = STAGE_ICONS[stage.id];
              const count = counts[stage.id];
              const active = count > 0;
              const isFilter = filter === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => setFilter(isFilter ? "all" : stage.id)}
                  className="flex flex-col items-center gap-3 bg-background px-2 group"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors
                      ${isFilter ? "border-primary bg-primary/20 text-primary" : active
                        ? "border-primary/70 bg-primary/10 text-primary"
                        : "border-border bg-secondary text-muted-foreground"} group-hover:border-primary`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <div className="font-serif font-medium text-foreground">{stage.label}</div>
                    <div className="text-xs text-muted-foreground">{count} active</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Worklist */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4 gap-4 flex-wrap">
            <h2 className="font-serif text-2xl">Next Actions</h2>
            <div className="flex gap-2 flex-wrap">
              <FilterChip label="All Stages" active={filter === "all"} onClick={() => setFilter("all")} />
              {JOURNEY_STAGES.map((stage) => (
                <FilterChip
                  key={stage.id}
                  label={stage.label}
                  active={filter === stage.id}
                  onClick={() => setFilter(stage.id)}
                />
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[88px] bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : !hasAnything ? (
            <div className="border border-border bg-card p-12 text-center flex flex-col items-center justify-center">
              <Compass className="w-12 h-12 text-muted mb-4" />
              <h3 className="text-lg font-medium mb-1">No relationships yet</h3>
              <p className="text-muted-foreground mb-4 text-sm max-w-sm">
                Add a prospect to begin the journey, or create a Source of Wealth assessment directly.
              </p>
              <Button onClick={() => setIsProspectOpen(true)} className="rounded-md bg-primary text-primary-foreground">
                Add First Prospect
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="border border-border bg-card p-10 text-center text-muted-foreground">
              No relationships at this stage.
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((item, i) => (
                <JourneyRow key={item.key} item={item} index={i} onOpen={() => setLocation(item.href)} />
              ))}
            </div>
          )}
        </section>

      </div>
    </Layout>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-md border transition-colors
        ${active
          ? "bg-secondary border-border text-foreground"
          : "border-transparent text-muted-foreground hover:bg-secondary/60"}`}
    >
      {label}
    </button>
  );
}

function JourneyRow({ item, index, onOpen }: { item: JourneyItem; index: number; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className={`group flex items-center gap-6 p-4 border transition-all hover:shadow-md cursor-pointer animate-in fade-in slide-in-from-bottom-2
        ${item.dormant ? "border-border bg-card/60 opacity-75 hover:opacity-100" : "border-border bg-card hover:border-primary/50"}`}
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: "backwards" }}
    >
      {/* Mini-journey dots */}
      <div className="hidden sm:flex w-28 shrink-0 items-center">
        <div className="flex w-full justify-between items-center relative">
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-border/60 -translate-y-1/2 z-0" />
          {JOURNEY_STAGES.map((s, i) => (
            <div
              key={s.id}
              className={`relative z-10 w-2.5 h-2.5 rounded-full border-2
                ${i < item.stageIndex
                  ? "bg-primary border-primary"
                  : i === item.stageIndex && !item.dormant
                    ? "bg-background border-primary scale-125"
                    : "bg-background border-border"}`}
            />
          ))}
        </div>
      </div>

      {/* Name + segment */}
      <div className="w-[220px] shrink-0 min-w-0">
        <div className="font-serif text-lg text-foreground flex items-center gap-2 truncate">
          <span className="truncate">{item.name}</span>
          {item.enhanced && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
        </div>
        {item.segment && <div className="text-sm text-muted-foreground mt-0.5 truncate">{item.segment}</div>}
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0 hidden md:block">
        <div className="text-sm text-foreground truncate">{item.meta}</div>
        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
          <span>RM: {item.relationshipManager || "Unassigned"}</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span>{JOURNEY_STAGES[item.stageIndex].label}</span>
        </div>
      </div>

      {/* Next action */}
      <div className="w-[200px] shrink-0 text-right pr-2 hidden lg:block">
        <div
          className={`text-sm font-medium flex items-center justify-end gap-1.5
            ${item.urgency === "high" ? "text-primary" : "text-foreground"}`}
        >
          {item.urgency === "high" && <Clock className="w-4 h-4" />}
          {item.nextAction}
        </div>
        <div className="text-xs text-muted-foreground mt-1">Pending action</div>
      </div>

      {/* Open */}
      <div className="shrink-0">
        <div className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
          <ArrowRight className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
