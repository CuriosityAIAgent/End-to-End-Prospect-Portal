import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProspects,
  useCreateProspect,
  getListProspectsQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { prospectStatusLabel } from "@/lib/prospectingCatalog";
import { Compass, Plus, ChevronRight, Sparkles, CheckCircle2, Target } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const statusTone: Record<string, string> = {
  identified: "bg-secondary text-secondary-foreground border-border",
  researching: "bg-secondary text-secondary-foreground border-border",
  briefed: "bg-primary/10 text-primary border-primary/20",
  outreach: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  converted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  dormant: "bg-muted text-muted-foreground border-border",
};

export default function Prospecting() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSegment, setNewSegment] = useState("");
  const [newRm, setNewRm] = useState("");

  const { data: prospects, isLoading } = useListProspects();
  const createProspect = useCreateProspect();
  const { toast } = useToast();

  const handleCreate = () => {
    if (!newName.trim()) return;
    createProspect.mutate({
      data: {
        name: newName.trim(),
        segment: newSegment.trim() || null,
        relationshipManager: newRm.trim() || null,
        status: "identified",
        data: {},
      },
    }, {
      onSuccess: (created) => {
        setIsCreateOpen(false);
        setNewName("");
        setNewSegment("");
        setNewRm("");
        queryClient.invalidateQueries({ queryKey: getListProspectsQueryKey() });
        setLocation(`/prospect/${created.id}`);
      },
      onError: (err) => {
        toast({
          title: "Failed to add prospect",
          description: err instanceof Error ? err.message : "An unexpected error occurred.",
          variant: "destructive",
        });
      },
    });
  };

  const total = prospects?.length ?? 0;
  const briefed = prospects?.filter(p => p.hasBriefing).length ?? 0;
  const converted = prospects?.filter(p => p.status === "converted").length ?? 0;

  return (
    <Layout>
      <div className="flex flex-col gap-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif text-foreground mb-2">Prospecting</h1>
            <p className="text-muted-foreground max-w-2xl">
              A systematic approach to origination — profile every prospect, work the three channels, and turn names into warm, routed introductions.
            </p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md shadow-md">
                <Plus className="w-4 h-4 mr-2" />
                New Prospect
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-md border-border bg-card">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Add Prospect</DialogTitle>
                <DialogDescription>
                  Capture the name to begin building the prospecting brief.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="p-name" className="text-sm font-medium">Prospect Name</label>
                  <Input
                    id="p-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="rounded-md bg-background border-border"
                    placeholder="e.g. Marcus Rourke"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="p-segment" className="text-sm font-medium">Segment <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    id="p-segment"
                    value={newSegment}
                    onChange={(e) => setNewSegment(e.target.value)}
                    className="rounded-md bg-background border-border"
                    placeholder="e.g. PE Partner, Founder, Family Office"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="p-rm" className="text-sm font-medium">Relationship Manager <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    id="p-rm"
                    value={newRm}
                    onChange={(e) => setNewRm(e.target.value)}
                    className="rounded-md bg-background border-border"
                    placeholder="e.g. A. Banker"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-md">Cancel</Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newName.trim() || createProspect.isPending}
                  className="rounded-md bg-primary text-primary-foreground"
                >
                  {createProspect.isPending ? "Adding..." : "Add Prospect"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border shadow-sm p-6">
            <div className="uppercase tracking-wider text-xs font-semibold text-muted-foreground flex items-center gap-2 mb-2">
              <Target className="w-4 h-4" /> Total Prospects
            </div>
            <div className="text-4xl font-serif">{total}</div>
          </div>
          <div className="bg-card border border-border shadow-sm p-6">
            <div className="uppercase tracking-wider text-xs font-semibold text-muted-foreground flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4" /> Briefed
            </div>
            <div className="text-4xl font-serif">{briefed}</div>
          </div>
          <div className="bg-card border border-border shadow-sm p-6">
            <div className="uppercase tracking-wider text-xs font-semibold text-muted-foreground flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4" /> Converted to Client
            </div>
            <div className="text-4xl font-serif text-emerald-600">{converted}</div>
          </div>
        </div>

        {/* List */}
        <div>
          <h2 className="text-2xl font-serif mb-4">Pipeline</h2>
          <div className="bg-card border border-border shadow-sm">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : !prospects?.length ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <Compass className="w-12 h-12 text-muted mb-4" />
                <h3 className="text-lg font-medium mb-1">No prospects yet</h3>
                <p className="text-muted-foreground mb-4 text-sm max-w-sm">
                  Add a prospect to start building a systematic prospecting brief.
                </p>
                <Button onClick={() => setIsCreateOpen(true)} className="rounded-md bg-primary text-primary-foreground">
                  Add First Prospect
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {prospects.map((p, i) => (
                  <div
                    key={p.id}
                    onClick={() => setLocation(`/prospect/${p.id}`)}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-secondary/20 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${i * 50}ms`, animationFillMode: "backwards" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <h3 className="font-serif text-lg truncate text-foreground">{p.name}</h3>
                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold border ${statusTone[p.status] ?? statusTone.identified}`}>
                          {prospectStatusLabel(p.status)}
                        </span>
                        {p.hasBriefing && (
                          <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] uppercase tracking-wider font-semibold border border-primary/20 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Briefed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {p.segment && <span>{p.segment}</span>}
                        <span>RM: {p.relationshipManager || "Unassigned"}</span>
                        <span>Updated {format(new Date(p.updatedAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
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
