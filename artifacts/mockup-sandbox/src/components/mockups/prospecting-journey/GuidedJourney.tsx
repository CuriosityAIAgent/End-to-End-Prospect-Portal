import React from "react";
import "./_group.css";
import { 
  ChevronRight, 
  Search, 
  Phone, 
  FileText, 
  Users, 
  ShieldCheck,
  MoreVertical,
  Clock,
  ArrowRight,
  AlertTriangle,
  Briefcase
} from "lucide-react";

const STAGES = [
  { id: "identify", label: "Identify", icon: Search },
  { id: "cold_call", label: "Cold Call", icon: Phone },
  { id: "brief", label: "Brief", icon: FileText },
  { id: "meet", label: "Meet", icon: Users },
  { id: "onboard", label: "Onboard", icon: ShieldCheck },
];

const METRICS = [
  { label: "Active Pipeline", value: "23" },
  { label: "Identify", value: "6" },
  { label: "Cold Call", value: "4" },
  { label: "Brief", value: "5" },
  { label: "Meet", value: "3" },
  { label: "Onboard", value: "5" },
  { label: "Converted Q3", value: "7" },
  { label: "Avg Days to Onboard", value: "38" },
  { label: "Pending Sign-offs", value: "3" },
];

const RELATIONSHIPS = [
  {
    id: 1,
    name: "Dr. Priya Nair",
    segment: "Founder, MedTech",
    rm: "A. Rossi",
    stage: "Identify",
    nextAction: "Draft cold-call anchor",
    meta: "No anchor yet",
    urgency: "normal",
  },
  {
    id: 2,
    name: "Eleanor Whitfield",
    segment: "PE Partner",
    rm: "J. Hartley",
    stage: "Cold Call",
    nextAction: "Log call outcome",
    meta: "Anchor: Tate Foundation board",
    urgency: "high",
  },
  {
    id: 3,
    name: "Amara Okafor",
    segment: "Hedge Fund CIO",
    rm: "A. Rossi",
    stage: "Brief",
    nextAction: "Add referral route",
    meta: "Missing connections",
    urgency: "normal",
  },
  {
    id: 4,
    name: "Marcus Chen",
    segment: "Tech Founder (post-IPO)",
    rm: "J. Hartley",
    stage: "Brief",
    nextAction: "Review AI briefing",
    meta: "Briefing generated 2h ago",
    urgency: "normal",
  },
  {
    id: 5,
    name: "Sofia Almeida",
    segment: "Family Office Principal",
    rm: "A. Rossi",
    stage: "Meet",
    nextAction: "Prepare question guide",
    meta: "Meeting Thu 3pm",
    urgency: "high",
  },
  {
    id: 6,
    name: "The Lindqvist Family",
    segment: "Industrial Wealth",
    rm: "J. Hartley",
    stage: "Meet",
    nextAction: "Confirm meeting",
    meta: "Pending invite response",
    urgency: "normal",
  },
  {
    id: 7,
    name: "Konstantin Petrov",
    segment: "Real Estate Magnate",
    rm: "J. Hartley",
    stage: "Onboard",
    nextAction: "Resolve red flags",
    meta: "SoW 41% · Risk: High · 2 Red Flags",
    urgency: "high",
    isRedFlag: true,
  },
  {
    id: 8,
    name: "The Harrington Trust",
    segment: "Inherited Wealth",
    rm: "J. Hartley",
    stage: "Onboard",
    nextAction: "Review SoW profile",
    meta: "SoW 72% · Risk: Medium",
    urgency: "normal",
  },
];

export function GuidedJourney() {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans flex flex-col">
      {/* Top Navigation & Brand */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur z-10 sticky top-0">
        <div className="max-w-[1400px] mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/30">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-serif text-xl tracking-wide text-foreground">
              Stanhope &amp; Co.
            </h1>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="w-4 h-4" />
              <span>RM Workspace</span>
            </div>
            <div className="w-px h-4 bg-border"></div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-medium text-foreground">Julian Hartley</div>
                <div className="text-xs text-muted-foreground">Senior Director</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center text-primary font-serif font-medium">
                JH
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-8 py-8 flex flex-col gap-10">
        
        {/* Journey Header & Metrics */}
        <section className="space-y-6">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-serif text-4xl mb-2">Prospecting Journey</h2>
              <p className="text-muted-foreground">Manage relationships from identification to onboarding.</p>
            </div>
            <div className="flex gap-4">
              <button className="px-4 py-2 border border-border rounded text-sm hover:bg-secondary transition-colors">
                View Reports
              </button>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2">
                <Search className="w-4 h-4" />
                Add Prospect
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm overflow-x-auto pb-2 scrollbar-hide">
            {METRICS.map((metric, i) => (
              <div key={metric.label} className="flex items-center gap-4 whitespace-nowrap">
                <div className="flex items-baseline gap-2">
                  <span className="text-muted-foreground">{metric.label}</span>
                  <span className="font-serif text-lg text-foreground">{metric.value}</span>
                </div>
                {i < METRICS.length - 1 && <div className="w-1 h-1 rounded-full bg-border" />}
              </div>
            ))}
          </div>
        </section>

        {/* Stage Rail */}
        <section className="relative">
          <div className="absolute top-1/2 left-0 w-full h-px bg-border -translate-y-1/2 z-0" />
          <div className="relative z-10 flex justify-between">
            {STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const activeCount = RELATIONSHIPS.filter(r => r.stage === stage.label).length;
              return (
                <div key={stage.id} className="flex flex-col items-center gap-3 bg-background px-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors
                    ${activeCount > 0 
                      ? "border-primary bg-primary/10 text-primary" 
                      : "border-border bg-secondary text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <div className="font-serif font-medium">{stage.label}</div>
                    <div className="text-xs text-muted-foreground">{activeCount} active</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Action List */}
        <section className="flex-1 space-y-6 pb-12">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h3 className="font-serif text-2xl">Next Actions</h3>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-sm bg-secondary rounded border border-border text-foreground">
                All Stages
              </button>
              <button className="px-3 py-1.5 text-sm rounded hover:bg-secondary text-muted-foreground transition-colors">
                My Clients Only
              </button>
            </div>
          </div>

          <div className="grid gap-3">
            {RELATIONSHIPS.map((rel) => {
              const stageIndex = STAGES.findIndex(s => s.label === rel.stage);
              return (
                <div 
                  key={rel.id} 
                  className={`group flex items-center gap-6 p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer
                    ${rel.isRedFlag ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card hover:border-primary/50'}`}
                >
                  
                  {/* Status Indicator (Mini Journey) */}
                  <div className="w-32 flex items-center shrink-0">
                    <div className="flex w-full justify-between items-center relative">
                      <div className="absolute top-1/2 left-0 w-full h-[2px] bg-border/50 -translate-y-1/2 z-0" />
                      {STAGES.map((s, i) => (
                        <div 
                          key={s.id}
                          className={`relative z-10 w-2.5 h-2.5 rounded-full border-2 
                            ${i < stageIndex ? 'bg-primary border-primary' : 
                              i === stageIndex ? 'bg-background border-primary scale-125' : 
                              'bg-background border-border'}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Client Info */}
                  <div className="w-[280px] shrink-0">
                    <div className="font-serif text-lg text-foreground flex items-center gap-2">
                      {rel.name}
                      {rel.isRedFlag && <AlertTriangle className="w-4 h-4 text-destructive" />}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{rel.segment}</div>
                  </div>

                  {/* Meta / Info */}
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm text-foreground">{rel.meta}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <span>RM: {rel.rm}</span>
                      <span className="w-1 h-1 rounded-full bg-border" />
                      <span>{rel.stage}</span>
                    </div>
                  </div>

                  {/* Next Action */}
                  <div className="w-[220px] shrink-0 text-right pr-4">
                    <div className={`text-sm font-medium flex items-center justify-end gap-1.5
                      ${rel.urgency === 'high' ? 'text-primary' : 'text-foreground'}`}
                    >
                      {rel.urgency === 'high' && <Clock className="w-4 h-4" />}
                      {rel.nextAction}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Pending action</div>
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0">
                    <button className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all">
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}
