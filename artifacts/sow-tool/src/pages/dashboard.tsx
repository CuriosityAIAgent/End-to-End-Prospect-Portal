import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListAssessments, 
  useGetOverview, 
  useCreateAssessment,
  getListAssessmentsQueryKey,
  getGetOverviewQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { calculateProgress } from "@/lib/progress";
import { reviewTypeOptions, riskRatingOptions } from "@/lib/sowCatalog";
import { FileText, Plus, AlertCircle, Clock, CheckCircle2, ChevronRight, ShieldAlert, FileSearch, Briefcase } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newReviewType, setNewReviewType] = useState<string>("onboarding");
  const [newRiskRating, setNewRiskRating] = useState<string>("standard");

  const { data: overview, isLoading: overviewLoading } = useGetOverview();
  const { data: assessments, isLoading: listLoading } = useListAssessments();
  const createAssessment = useCreateAssessment();

  const handleCreate = async () => {
    if (!newClientName.trim()) return;
    
    createAssessment.mutate({
      data: {
        clientName: newClientName,
        reviewType: newReviewType as any,
        riskRating: newRiskRating as any,
        status: "draft",
        data: {}
      }
    }, {
      onSuccess: (newAssessment) => {
        setIsCreateOpen(false);
        setNewClientName("");
        queryClient.invalidateQueries({ queryKey: getListAssessmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
        setLocation(`/assessment/${newAssessment.id}`);
      }
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-amber-500" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed": return "Completed";
      case "in_progress": return "In Progress";
      default: return "Draft";
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif text-foreground mb-2">Portfolio Overview</h1>
            <p className="text-muted-foreground">Manage and track client Source of Wealth due diligence.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-none shadow-md">
                <Plus className="w-4 h-4 mr-2" />
                New Assessment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-none border-border bg-card">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Create Assessment</DialogTitle>
                <DialogDescription>
                  Start a new Source of Wealth questionnaire for a client.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="name" className="text-sm font-medium">Client Name</label>
                  <Input 
                    id="name" 
                    value={newClientName} 
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="rounded-none bg-background border-border"
                    placeholder="e.g. John Doe or Acme Corp"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Review Type</label>
                  <Select value={newReviewType} onValueChange={setNewReviewType}>
                    <SelectTrigger className="rounded-none bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {reviewTypeOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Risk Rating</label>
                  <Select value={newRiskRating} onValueChange={setNewRiskRating}>
                    <SelectTrigger className="rounded-none bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none">
                      {riskRatingOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-none">Cancel</Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={!newClientName.trim() || createAssessment.isPending}
                  className="rounded-none bg-primary text-primary-foreground"
                >
                  {createAssessment.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        {overviewLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-card border border-border animate-pulse" />)}
          </div>
        ) : overview ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="rounded-none border-border shadow-sm bg-card">
              <CardHeader className="pb-2">
                <CardDescription className="uppercase tracking-wider text-xs font-semibold text-muted-foreground flex items-center gap-2">
                  <FileSearch className="w-4 h-4" /> Total Assessments
                </CardDescription>
                <CardTitle className="text-4xl font-serif">{overview.total}</CardTitle>
              </CardHeader>
            </Card>
            
            <Card className="rounded-none border-border shadow-sm bg-card">
              <CardHeader className="pb-2">
                <CardDescription className="uppercase tracking-wider text-xs font-semibold text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Active Pipeline
                </CardDescription>
                <div className="flex gap-4 mt-2">
                  {overview.byStatus.map(s => (
                    <div key={s.status} className="flex flex-col">
                      <span className="text-2xl font-serif">{s.count}</span>
                      <span className="text-xs text-muted-foreground">{getStatusLabel(s.status)}</span>
                    </div>
                  ))}
                </div>
              </CardHeader>
            </Card>

            <Card className="rounded-none border-destructive/20 shadow-sm bg-card relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldAlert className="w-16 h-16 text-destructive" />
              </div>
              <CardHeader className="pb-2 relative z-10">
                <CardDescription className="uppercase tracking-wider text-xs font-semibold text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" /> Enhanced Due Diligence
                </CardDescription>
                <div className="flex flex-col mt-2">
                  <span className="text-4xl font-serif text-amber-500">
                    {overview.byRisk.find(r => r.riskRating === 'enhanced')?.count || 0}
                  </span>
                  <span className="text-xs text-muted-foreground">High Risk Clients</span>
                </div>
              </CardHeader>
            </Card>
          </div>
        ) : null}

        {/* List */}
        <div>
          <h2 className="text-2xl font-serif mb-4 flex items-center gap-2">
            Client Assessments
          </h2>
          
          <div className="bg-card border border-border shadow-sm">
            {listLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : !assessments?.length ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Briefcase className="w-12 h-12 text-muted mb-4" />
                <h3 className="text-lg font-medium mb-1">No assessments yet</h3>
                <p className="text-muted-foreground mb-4 text-sm max-w-sm">
                  Start by creating a new Source of Wealth assessment for your client.
                </p>
                <Button onClick={() => setIsCreateOpen(true)} className="rounded-none bg-primary text-primary-foreground">
                  Create First Assessment
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {assessments.map((assessment, i) => (
                  <div 
                    key={assessment.id}
                    onClick={() => setLocation(`/assessment/${assessment.id}`)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-secondary/20 cursor-pointer transition-colors animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-serif text-lg truncate text-foreground">{assessment.clientName}</h3>
                        {assessment.riskRating === 'enhanced' && (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] uppercase tracking-wider font-semibold border border-amber-500/20">
                            EDD
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-[10px] uppercase tracking-wider font-semibold border border-border">
                          {reviewTypeOptions.find(o => o.value === assessment.reviewType)?.label || assessment.reviewType}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {getStatusIcon(assessment.status)}
                          {getStatusLabel(assessment.status)}
                        </span>
                        <span>Ref: {assessment.clientReference || 'Unassigned'}</span>
                        <span>Updated {format(new Date(assessment.updatedAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}
