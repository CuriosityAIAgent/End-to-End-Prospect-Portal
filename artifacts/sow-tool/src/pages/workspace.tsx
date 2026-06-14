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
import { SectionInfo } from "@/components/section-info";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { calculateProgress } from "@/lib/progress";
import { 
  wealthCategories, 
  sourceOfFundsQuestions, 
  sourceOfFundsDocuments, 
  plausibilityChecks, 
  redFlags, 
  signOffFields,
  statusOptions,
  riskRatingOptions,
  reviewTypeOptions
} from "@/lib/sowCatalog";
import { 
  Printer, Trash2, ChevronLeft, Save, AlertCircle, CheckCircle2, 
  Briefcase, CheckSquare, ShieldAlert, FileText, ChevronDown, ChevronRight
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

// Document state options
const DOC_STATES = [
  { value: "pending", label: "Pending" },
  { value: "provided", label: "Provided & Verified" },
  { value: "waived", label: "Waived (Rationale Required)" },
  { value: "na", label: "Not Applicable" },
] as const;

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

  const progress = calculateProgress(localData);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto flex flex-col gap-8 pb-24 print:pb-0">
        
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

        {/* Meeting file note */}
        <FileNotePanel
          value={localData.fileNote}
          onChange={(v) => handleDataChange("fileNote", v)}
          contactName={assessment.clientName}
          defaultMeetingType="Client review"
        />

        {/* Questionnaire Form */}
        <div className="flex flex-col gap-12">
          
          {/* Section 1: Source of Wealth Statement */}
          <Section title="1. Source of Wealth Statement" icon={<Briefcase className="w-5 h-5" />} helpId="assessment.profile">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Client Reference / RM ID</label>
                <Input 
                  value={localMeta.clientReference} 
                  onChange={(e) => handleMetaChange('clientReference', e.target.value)}
                  className="rounded-md border-border bg-card"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Relationship Manager</label>
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
          </Section>

          {/* Section 2: Wealth Categories */}
          <Section title="2. Wealth Categories" icon={<FileText className="w-5 h-5" />} helpId="assessment.wealthCategories">
            <p className="text-sm text-muted-foreground mb-6">
              Select all categories that apply to this client's overall wealth footprint. Expand each to complete the relevant questions and document checks.
            </p>
            
            <div className="flex flex-col gap-4">
              {wealthCategories.map((cat) => {
                const applicableCats = (localData["applicableCategories"] as string[]) || [];
                const isApplicable = applicableCats.includes(cat.id);
                
                return (
                  <div key={cat.id} className={`border transition-all duration-300 ${isApplicable ? 'border-primary shadow-sm bg-card' : 'border-border bg-background'}`}>
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer transition-colors hover:bg-secondary/20"
                      onClick={() => {
                        const next = isApplicable 
                          ? applicableCats.filter(id => id !== cat.id)
                          : [...applicableCats, cat.id];
                        handleDataChange("applicableCategories", next);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={isApplicable} 
                          onCheckedChange={(checked) => {
                            const next = checked 
                              ? [...applicableCats, cat.id]
                              : applicableCats.filter(id => id !== cat.id);
                            handleDataChange("applicableCategories", next);
                          }}
                          className="rounded-sm border-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div>
                          <h3 className="font-serif font-medium">{cat.name}</h3>
                          {!isApplicable && <p className="text-xs text-muted-foreground line-clamp-1">{cat.intro}</p>}
                        </div>
                      </div>
                      {isApplicable ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    
                    {isApplicable && (
                      <div className="p-6 border-t border-border border-primary/20 bg-card flex flex-col gap-8 animate-in slide-in-from-top-2 duration-300 print:block">
                        <p className="text-sm text-muted-foreground">{cat.intro}</p>
                        
                        <div className="space-y-6">
                          <h4 className="font-serif text-lg border-b border-border pb-2">Questions</h4>
                          {cat.questions.map((q) => (
                            <div key={q.id} className="space-y-2">
                              <label className="text-sm font-medium text-foreground/90">{q.label}</label>
                              <Textarea 
                                value={localData[q.id] || ""}
                                onChange={(e) => handleDataChange(q.id, e.target.value)}
                                className="min-h-[80px] rounded-md border-border bg-background focus-visible:ring-primary"
                              />
                            </div>
                          ))}
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-serif text-lg border-b border-border pb-2 mt-4">Documentary Evidence</h4>
                          <div className="grid gap-3">
                            {cat.documents.map((d) => (
                              <div key={d.id} className="flex flex-col md:flex-row md:items-start justify-between gap-4 p-4 border border-border bg-background">
                                <span className="text-sm flex-1">{d.label}</span>
                                <Select 
                                  value={localData[d.id] || ""} 
                                  onValueChange={(v) => handleDataChange(d.id, v)}
                                >
                                  <SelectTrigger className="w-[200px] h-8 rounded-md border-border">
                                    <SelectValue placeholder="Select state..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-md">
                                    {DOC_STATES.map(state => (
                                      <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Section 3: Source of Funds */}
          <Section title="3. Source of Funds (Specific Transaction)" icon={<FileText className="w-5 h-5" />} helpId="assessment.sourceOfFunds">
            <div className="space-y-8">
              {sourceOfFundsQuestions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/90">{q.label}</label>
                  <Textarea 
                    value={localData[q.id] || ""}
                    onChange={(e) => handleDataChange(q.id, e.target.value)}
                    className="min-h-[80px] rounded-md border-border bg-card"
                  />
                </div>
              ))}
              
              <div className="mt-8 space-y-4">
                <h4 className="font-serif text-lg border-b border-border pb-2">Required Documents</h4>
                <div className="grid gap-3">
                  {sourceOfFundsDocuments.map((d) => (
                    <div key={d.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-border bg-card">
                      <span className="text-sm flex-1">{d.label}</span>
                      <Select 
                        value={localData[d.id] || ""} 
                        onValueChange={(v) => handleDataChange(d.id, v)}
                      >
                        <SelectTrigger className="w-[200px] h-8 rounded-md border-border bg-background">
                          <SelectValue placeholder="Select state..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-md">
                          {DOC_STATES.map(state => (
                            <SelectItem key={state.value} value={state.value}>{state.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Section 4: Plausibility */}
          <Section title="4. Plausibility & Corroboration" icon={<CheckSquare className="w-5 h-5" />} helpId="assessment.plausibility">
            <p className="text-sm text-muted-foreground mb-6">
              Review and confirm the plausibility of the overall picture presented.
            </p>
            <div className="grid gap-4">
              {plausibilityChecks.map((c) => (
                <label key={c.id} className="flex items-start gap-4 p-4 border border-border bg-card hover:bg-secondary/10 cursor-pointer transition-colors">
                  <Checkbox 
                    checked={!!localData[c.id]}
                    onCheckedChange={(checked) => handleDataChange(c.id, checked)}
                    className="mt-0.5 rounded-sm data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white border-border"
                  />
                  <span className="text-sm font-medium">{c.label}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Section 5: Red Flags */}
          <Section title="5. Red Flags & Escalation" icon={<ShieldAlert className="w-5 h-5 text-amber-500" />} className="border-t-4 border-amber-500/50" helpId="assessment.redFlags">
            <p className="text-sm text-muted-foreground mb-6">
              Identify any risk factors present during this assessment. Selecting any of these may require escalation.
            </p>
            <div className="grid gap-4">
              {redFlags.map((f) => (
                <label key={f.id} className="flex items-start gap-4 p-4 border border-border bg-card hover:bg-amber-500/5 cursor-pointer transition-colors">
                  <Checkbox 
                    checked={!!localData[f.id]}
                    onCheckedChange={(checked) => handleDataChange(f.id, checked)}
                    className="mt-0.5 rounded-sm data-[state=checked]:bg-amber-500 data-[state=checked]:text-white border-border"
                  />
                  <span className="text-sm font-medium">{f.label}</span>
                </label>
              ))}
              
              <div className="mt-4 space-y-2">
                <label className="text-sm font-semibold">Details of any red flags identified and mitigations applied:</label>
                <Textarea 
                  value={localData["flags.mitigation"] || ""}
                  onChange={(e) => handleDataChange("flags.mitigation", e.target.value)}
                  className="min-h-[100px] rounded-md border-border bg-card"
                  placeholder="Provide context..."
                />
              </div>
            </div>
          </Section>

          {/* Section 6: Sign-off */}
          <Section title="6. RM Assessment & Sign-off" icon={<FileText className="w-5 h-5" />} helpId="assessment.signOff">
            <div className="space-y-8">
              {signOffFields.map((field) => (
                <div key={field.id} className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/90">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <Textarea 
                      value={localData[field.id] || ""}
                      onChange={(e) => handleDataChange(field.id, e.target.value)}
                      className="min-h-[100px] rounded-md border-border bg-card"
                    />
                  ) : field.type === 'select' ? (
                    <Select value={localData[field.id] || ""} onValueChange={(v) => handleDataChange(field.id, v)}>
                      <SelectTrigger className="rounded-md border-border bg-card">
                        <SelectValue placeholder="Select conclusion..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-md">
                        {field.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      value={localData[field.id] || ""}
                      onChange={(e) => handleDataChange(field.id, e.target.value)}
                      className="rounded-md border-border bg-card"
                    />
                  )}
                </div>
              ))}
              
              <div className="pt-6 border-t border-border flex justify-end print:hidden">
                <Button 
                  onClick={() => handleMetaChange("status", "completed")}
                  className="rounded-md bg-primary text-primary-foreground"
                  disabled={localMeta.status === "completed"}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Assessment as Completed
                </Button>
              </div>
            </div>
          </Section>

        </div>
      </div>
    </Layout>
  );
}

// Sub-component for consistent section styling
function Section({ title, icon, children, className = "", helpId }: { title: string, icon: React.ReactNode, children: React.ReactNode, className?: string, helpId?: string }) {
  return (
    <section className={`bg-card/50 border border-border shadow-sm p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ${className}`}>
      <div className="flex items-center gap-3 mb-8 border-b border-border pb-4">
        <div className="text-primary">{icon}</div>
        <h2 className="text-2xl font-serif text-foreground">{title}</h2>
        {helpId && <SectionInfo id={helpId} className="ml-1" />}
      </div>
      <div>
        {children}
      </div>
    </section>
  );
}
