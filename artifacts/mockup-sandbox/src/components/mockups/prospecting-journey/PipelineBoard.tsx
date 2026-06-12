import React from "react";
import "./_group.css";
import { 
  Search, 
  Phone, 
  FileText, 
  Users, 
  FileCheck2,
  ChevronRight,
  Clock,
  AlertTriangle,
  ArrowRight,
  Filter,
  Plus
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

type Prospect = {
  id: string;
  name: string;
  segment: string;
  rm: string;
  stage: "Identify" | "Cold Call" | "Brief" | "Meet" | "Onboard";
  nextAction: string;
  anchor?: string;
  meeting?: string;
  sowProgress?: number;
  risk?: "Low" | "Medium" | "High";
  redFlags?: number;
  daysInStage: number;
};

const prospects: Prospect[] = [
  { id: "1", name: "Dr. Priya Nair", segment: "Founder, MedTech", rm: "A. Rossi", stage: "Identify", nextAction: "Draft cold-call anchor", daysInStage: 2 },
  { id: "2", name: "Eleanor Whitfield", segment: "PE Partner", rm: "J. Hartley", stage: "Cold Call", nextAction: "Log call outcome", anchor: "Tate Foundation board", daysInStage: 5 },
  { id: "3", name: "Marcus Chen", segment: "Tech Founder (post-IPO)", rm: "J. Hartley", stage: "Brief", nextAction: "Review AI briefing", daysInStage: 1 },
  { id: "4", name: "Amara Okafor", segment: "Hedge Fund CIO", rm: "A. Rossi", stage: "Brief", nextAction: "Add referral route", daysInStage: 3 },
  { id: "5", name: "Sofia Almeida", segment: "Family Office Principal", rm: "A. Rossi", stage: "Meet", nextAction: "Prepare question guide", meeting: "Thu 3pm", daysInStage: 4 },
  { id: "6", name: "The Lindqvist Family", segment: "Industrial Wealth", rm: "J. Hartley", stage: "Meet", nextAction: "Confirm meeting", daysInStage: 7 },
  { id: "7", name: "The Harrington Trust", segment: "Inherited Wealth", rm: "J. Hartley", stage: "Onboard", nextAction: "Complete SoW checks", sowProgress: 72, risk: "Medium", daysInStage: 14 },
  { id: "8", name: "Konstantin Petrov", segment: "Real Estate Magnate", rm: "J. Hartley", stage: "Onboard", nextAction: "Review red flags", sowProgress: 41, risk: "High", redFlags: 2, daysInStage: 28 },
];

const STAGES = [
  { id: "Identify", label: "Identify", icon: Search, count: 6 },
  { id: "Cold Call", label: "Cold Call", icon: Phone, count: 4 },
  { id: "Brief", label: "Brief", icon: FileText, count: 5 },
  { id: "Meet", label: "Meet", icon: Users, count: 3 },
  { id: "Onboard", label: "Onboard", icon: FileCheck2, count: 5 },
] as const;

export function PipelineBoard() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col selection:bg-primary selection:text-primary-foreground">
      {/* Top Navigation / Portfolio Summary Band */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/95 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 pr-6 border-r border-border/50">
            <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center">
              <span className="font-serif font-bold text-primary-foreground text-lg">H</span>
            </div>
            <div>
              <h1 className="font-serif text-lg leading-tight tracking-tight text-foreground">Pipeline Board</h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Hartley & Rossi</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span className="text-foreground font-medium">23 Active</span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span> Converted this Q: <span className="text-foreground">7</span></span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span> Avg days-to-onboard: <span className="text-foreground">38</span></span>
            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-destructive"></span> SoW pending: <span className="text-foreground">3</span></span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-8 border-border bg-card hover:bg-accent text-xs">
            <Filter className="w-3.5 h-3.5 mr-2" /> Filter
          </Button>
          <Button size="sm" className="h-8 bg-primary text-primary-foreground hover:bg-primary/90 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Prospect
          </Button>
        </div>
      </header>

      {/* Board Scroll Area */}
      <main className="flex-1 overflow-x-auto p-6">
        <div className="flex items-start gap-4 h-full min-w-max">
          {STAGES.map((stage) => {
            const stageProspects = prospects.filter(p => p.stage === stage.id);
            const Icon = stage.icon;
            
            return (
              <div key={stage.id} className="flex flex-col w-[340px] shrink-0 h-full max-h-[calc(100vh-100px)]">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4 px-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Icon className="w-4 h-4" />
                    <h2 className="font-serif text-lg text-foreground tracking-tight">{stage.label}</h2>
                  </div>
                  <Badge variant="secondary" className="bg-secondary/50 text-muted-foreground hover:bg-secondary/50 font-normal rounded-sm px-1.5 h-5 text-xs">
                    {stage.count}
                  </Badge>
                </div>
                
                {/* Column Cards Container */}
                <div className="flex flex-col gap-3 overflow-y-auto pb-6 custom-scrollbar pr-1">
                  {stageProspects.map(prospect => (
                    <ProspectCard key={prospect.id} prospect={prospect} />
                  ))}
                  {/* Empty state for demonstration if needed */}
                  {stageProspects.length === 0 && (
                    <div className="border border-dashed border-border/50 rounded-md p-6 text-center">
                      <p className="text-sm text-muted-foreground">No prospects in {stage.label}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function ProspectCard({ prospect }: { prospect: Prospect }) {
  return (
    <Card className="bg-card border-border/60 rounded-md shadow-sm transition-all duration-200 hover:border-primary/50 hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] group cursor-pointer relative overflow-hidden">
      {/* Accent top border based on risk/status */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${
        prospect.risk === 'High' ? 'bg-destructive' : 
        prospect.risk === 'Medium' ? 'bg-amber-500/50' : 
        'bg-primary/20 group-hover:bg-primary/50 transition-colors'
      }`} />
      
      <CardHeader className="p-4 pb-3 space-y-0">
        <div className="flex justify-between items-start">
          <div className="space-y-1 w-full pr-4">
            <CardTitle className="font-serif text-lg leading-tight tracking-tight truncate text-foreground group-hover:text-primary transition-colors">
              {prospect.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground truncate">{prospect.segment}</p>
          </div>
          <Avatar className="w-6 h-6 border border-border/50 shrink-0">
            <AvatarFallback className="bg-secondary text-[10px] text-secondary-foreground font-medium">
              {prospect.rm.split(' ')[0][0]}{prospect.rm.split(' ')[1]?.[0] || ''}
            </AvatarFallback>
          </Avatar>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pt-0 space-y-3">
        {/* Contextual Info (Anchor, Meeting, SoW) */}
        <div className="space-y-2">
          {prospect.anchor && (
            <div className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground mt-0.5"><Search className="w-3 h-3" /></span>
              <span className="text-foreground/80 leading-snug line-clamp-2">Anchor: {prospect.anchor}</span>
            </div>
          )}
          
          {prospect.meeting && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-primary mt-0.5"><Clock className="w-3 h-3" /></span>
              <span className="text-primary font-medium">Meeting {prospect.meeting}</span>
            </div>
          )}
          
          {prospect.sowProgress !== undefined && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-end text-xs">
                <span className="text-muted-foreground">SoW Completion</span>
                <span className="font-mono text-foreground">{prospect.sowProgress}%</span>
              </div>
              <Progress value={prospect.sowProgress} className="h-1 bg-secondary" />
              
              {(prospect.risk || prospect.redFlags) && (
                <div className="flex items-center gap-2 mt-2">
                  {prospect.risk && (
                    <Badge variant="outline" className={`text-[10px] uppercase px-1.5 py-0 h-4 border-border font-medium tracking-wider
                      ${prospect.risk === 'High' ? 'text-destructive border-destructive/30 bg-destructive/10' : 
                        prospect.risk === 'Medium' ? 'text-amber-500 border-amber-500/30 bg-amber-500/10' : 
                        'text-muted-foreground'}
                    `}>
                      {prospect.risk} RISK
                    </Badge>
                  )}
                  {prospect.redFlags && prospect.redFlags > 0 && (
                    <span className="flex items-center text-[10px] text-destructive font-medium">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {prospect.redFlags} FLAGS
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="pt-3 border-t border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{prospect.daysInStage}d in stage</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground group-hover:text-primary transition-colors">
            <span className="truncate max-w-[140px] text-right">{prospect.nextAction}</span>
            <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
