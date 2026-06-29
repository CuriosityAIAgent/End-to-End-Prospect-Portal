import type { ReactNode } from "react";
import { Check, ChevronDown, Compass } from "lucide-react";

// ── Journey rail + step sections ────────────────────────────────────────────
// One backbone for the whole prospect→client journey. The rail is always
// visible (sticky) and tells the banker where they are and lets them jump
// between steps; the page below shows the steps as an accordion so only the
// active one is open. The SAME rail+steps render on the prospect page and the
// post-convert assessment page, so the flow never looks like two tools.

export type StepStatus = "done" | "current" | "todo";

export interface JourneyStep {
  key: string;
  label: string;
  status: StepStatus;
}

/** Numbered dot / tick shared by the rail and the section headers. */
function StepDot({ index, status, active }: { index: number; status: StepStatus; active: boolean }) {
  if (status === "done") {
    return (
      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-emerald-100 text-emerald-700 border border-emerald-200">
        <Check className="w-3.5 h-3.5" />
      </span>
    );
  }
  return (
    <span
      className={[
        "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold border",
        active ? "border-primary text-primary bg-primary/10" : "border-muted-foreground/30 text-muted-foreground",
      ].join(" ")}
    >
      {index + 1}
    </span>
  );
}

export function JourneyRail({
  steps,
  activeKey,
  onSelect,
  title = "Plan of action",
}: {
  steps: JourneyStep[];
  activeKey: string;
  onSelect: (key: string) => void;
  title?: string;
}) {
  return (
    <nav aria-label="Prospect journey" className="lg:sticky lg:top-24 print:hidden">
      <div className="flex items-center gap-2 mb-3">
        <Compass className="w-4 h-4 text-primary" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{title}</h2>
      </div>
      <ol className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
        {steps.map((s, i) => {
          const active = s.key === activeKey;
          return (
            <li key={s.key} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onSelect(s.key)}
                aria-current={active ? "step" : undefined}
                className={[
                  "w-full flex items-center gap-2.5 text-left text-sm rounded-md px-2.5 py-2 border transition-colors",
                  active
                    ? "border-primary/40 bg-primary/5 text-foreground font-medium"
                    : "border-transparent hover:bg-secondary text-muted-foreground",
                ].join(" ")}
              >
                <StepDot index={i} status={s.status} active={active} />
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** One accordion step. Body stays mounted (state + any running job survive) and
 *  is collapsed with `hidden` when not active; print expands every step. */
export function StepSection({
  id,
  index,
  title,
  summary,
  status,
  active,
  onActivate,
  children,
}: {
  id: string;
  index: number;
  title: string;
  /** One-line hint shown on the collapsed header. */
  summary?: string;
  status: StepStatus;
  active: boolean;
  onActivate: () => void;
  children: ReactNode;
}) {
  return (
    <section id={id} className="border border-border bg-card scroll-mt-24 overflow-hidden">
      <button
        type="button"
        onClick={onActivate}
        aria-expanded={active}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-secondary/40 transition-colors print:hover:bg-transparent"
      >
        <StepDot index={index} status={status} active={active} />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-serif leading-tight">{title}</h2>
          {summary && !active && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">{summary}</p>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform print:hidden ${active ? "rotate-180" : ""}`}
        />
      </button>
      <div className={active ? "block" : "hidden print:block"}>
        <div className="px-5 pb-6 pt-1 border-t border-border min-w-0">{children}</div>
      </div>
    </section>
  );
}
