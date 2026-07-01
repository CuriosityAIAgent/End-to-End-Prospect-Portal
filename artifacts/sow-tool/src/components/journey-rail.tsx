import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Compass } from "lucide-react";

// ── Journey rail + step sections ────────────────────────────────────────────
// One backbone for the whole prospect→client journey, IDENTICAL on the prospect
// page and the converted (assessment) page. The rail is sticky and lets the
// banker jump between the four steps; a scroll-spy highlight shows where they
// are so it never gets lost. The steps below are one continuous document — all
// open by default, each independently collapsible. There is deliberately NO
// per-step "done/todo" status any more: the four are just navigable anchors.

export interface JourneyStep {
  key: string;
  label: string;
}

/** Numbered dot shared by the rail and the section headers. */
function StepDot({ index, active }: { index: number; active: boolean }) {
  return (
    <span
      className={[
        "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-semibold border",
        active
          ? "border-primary text-primary bg-primary/10"
          : "border-muted-foreground/30 text-muted-foreground",
      ].join(" ")}
    >
      {index + 1}
    </span>
  );
}

/** Which step section is currently in view — drives the rail highlight so the
 *  banker can keep track of where they are without scrolling back up. */
function useScrollSpy(keys: string[]): string {
  const [active, setActive] = useState(keys[0] ?? "");
  const signature = keys.join("|");
  useEffect(() => {
    const els = keys
      .map((k) => document.getElementById(`step-${k}`))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace(/^step-/, ""));
      },
      // Active band runs from just below the sticky header down to ~45% of the
      // viewport — wide enough that even a collapsed (header-only) section still
      // intersects it, so the highlight never gets stuck on the previous step.
      { rootMargin: "-80px 0px -55% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return active;
}

export function JourneyRail({
  steps,
  onSelect,
  title = "Plan of action",
}: {
  steps: JourneyStep[];
  onSelect: (key: string) => void;
  title?: string;
}) {
  const activeKey = useScrollSpy(steps.map((s) => s.key));
  return (
    <nav aria-label="Prospect journey" className="md:sticky md:top-20 md:self-start print:hidden">
      <div className="flex items-center gap-2 mb-4">
        <Compass className="w-4 h-4 text-primary" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{title}</h2>
      </div>
      <ol className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible">
        {steps.map((s, i) => {
          const active = s.key === activeKey;
          return (
            <li key={s.key} className="shrink-0 md:shrink">
              <button
                type="button"
                onClick={() => onSelect(s.key)}
                aria-current={active ? "step" : undefined}
                className={[
                  "w-full flex items-center gap-2.5 text-left text-sm rounded-md px-3 py-2.5 border transition-colors",
                  active
                    ? "border-primary/40 bg-primary/5 text-foreground font-medium"
                    : "border-transparent hover:bg-secondary text-muted-foreground",
                ].join(" ")}
              >
                <StepDot index={i} active={active} />
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
  active,
  onActivate,
  children,
}: {
  id: string;
  index: number;
  title: string;
  /** One-line hint shown on the collapsed header. */
  summary?: string;
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
        <StepDot index={index} active={active} />
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
