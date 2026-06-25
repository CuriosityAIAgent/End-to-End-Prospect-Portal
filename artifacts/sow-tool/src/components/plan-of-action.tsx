import type { ReactNode } from "react";
import { Check, Compass } from "lucide-react";
import type { PrepPack } from "@workspace/research-pipeline/types";

// ── Plan of action — the staged prospecting framework, at the top of the page ──
// Per Rupert's feedback the banker should see, first, HOW we'll work this
// prospect: take the name → brief & qualify → approach (referral or cold) → meet
// → Source of Wealth. This header frames that flow, tracks where the prospect
// currently sits, and gives one tailored next action. All derived from data we
// already have — no extra AI call.

type StageKey = "brief" | "approach" | "meeting" | "sow";

interface Stage {
  key: StageKey;
  label: string;
  done: boolean;
}

export interface PlanOfActionProps {
  prep?: PrepPack;
  briefing?: unknown;
  approachUsed: boolean;
  hasFileNote: boolean;
  isConverted: boolean;
}

/** Does the briefing carry any warm referral routes? (best-effort, shape-tolerant) */
function hasReferralRoutes(briefing: unknown): boolean {
  if (!briefing || typeof briefing !== "object") return false;
  const r = (briefing as { referralRoutes?: unknown }).referralRoutes;
  return Array.isArray(r) && r.length > 0;
}

function buildStages(p: PlanOfActionProps): Stage[] {
  const hasPrep = !!p.prep;
  return [
    { key: "brief", label: "Brief & qualify", done: hasPrep },
    { key: "approach", label: "Approach", done: p.approachUsed },
    { key: "meeting", label: "Meeting", done: p.hasFileNote },
    { key: "sow", label: "Source of Wealth", done: p.isConverted },
  ];
}

/** The single tailored next action, by where the prospect sits in the flow. */
function nextAction(p: PlanOfActionProps): string {
  const qual = p.prep?.wealthEstimate?.qualification;
  if (!p.prep) {
    return "Generate the brief to qualify this prospect (>$25M?) and shape the approach.";
  }
  if (qual?.verdict === "below") {
    return "Best estimate is below the $25M bar — qualify hard before investing more time.";
  }
  if (!p.approachUsed) {
    return hasReferralRoutes(p.briefing)
      ? "Warm routes look available — try a referral before going cold (see the approach below)."
      : "No obvious warm route — prepare a cold approach (email or call) aimed only at securing a 30-minute meeting.";
  }
  if (!p.hasFileNote) {
    return "Approach underway — after the meeting, capture the file note so it can build the Source of Wealth.";
  }
  if (!p.isConverted) {
    return "Meeting captured — convert to a Source of Wealth assessment to prove the source of wealth.";
  }
  return "Onboarded — a Source of Wealth assessment has been created from this prospect.";
}

function Pill({ children, tone }: { children: ReactNode; tone: "above" | "borderline" | "below" }) {
  const cls =
    tone === "above"
      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
      : tone === "borderline"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-stone-100 border-stone-300 text-stone-600";
  return <span className={`text-[11px] px-2 py-0.5 border rounded ${cls}`}>{children}</span>;
}

export function PlanOfAction(props: PlanOfActionProps) {
  const stages = buildStages(props);
  // The active stage is the first not-yet-done one.
  const activeIdx = stages.findIndex((s) => !s.done);
  const qual = props.prep?.wealthEstimate?.qualification;

  return (
    <section className="border border-border bg-card p-6 print:border-0 print:p-0">
      <div className="flex items-center gap-2 mb-1">
        <Compass className="w-4 h-4 text-primary" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Plan of action</h2>
        {qual && (
          <span className="ml-auto print:hidden">
            <Pill tone={qual.verdict}>
              {qual.verdict === "above" ? "Qualifies · >$25M" : qual.verdict === "below" ? "Below $25M bar" : "Borderline · confirm"}
            </Pill>
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Take the name → brief &amp; qualify → approach via referral or cold → meet → Source of Wealth.
      </p>

      {/* Stage tracker */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-5">
        {stages.map((s, i) => {
          const isActive = i === activeIdx;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span
                className={[
                  "flex items-center gap-1.5 text-sm px-2.5 py-1 rounded border",
                  s.done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : isActive
                      ? "border-primary/40 bg-primary/5 text-foreground font-medium"
                      : "border-border bg-background text-muted-foreground",
                ].join(" ")}
              >
                {s.done ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span
                    className={`inline-block w-3.5 h-3.5 rounded-full border ${isActive ? "border-primary" : "border-muted-foreground/40"}`}
                  />
                )}
                {s.label}
              </span>
              {i < stages.length - 1 && <span className="text-muted-foreground/40">›</span>}
            </li>
          );
        })}
      </ol>

      {/* Tailored next action */}
      <div className="flex items-start gap-2 text-[15px] text-foreground border-t border-border pt-4">
        <span className="text-primary font-semibold shrink-0">Next:</span>
        <span>{nextAction(props)}</span>
      </div>
    </section>
  );
}
