import { ClipboardList } from "lucide-react";
import type { PrepPack } from "@workspace/research-pipeline/types";

// ── Meeting fact-find ────────────────────────────────────────────────────────
// The data points the banker must collect IN the meeting so the Source of Wealth
// can be completed afterwards. Structure is Rupert's meeting-note fact-find
// (Income / Expenditure / Assets / Liabilities). Where our estimate already has
// an anticipated figure, we surface it as a prompt to confirm — turning the
// estimate's assumptions into things to validate live.

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}bn`;
  if (abs >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  if (abs >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${Math.round(n)}`;
}

/** Pull anticipated figures from the estimate's ledger, by line category. */
function anticipated(prep?: PrepPack): {
  comp?: string;
  carryRealised?: string;
  carryUnrealised?: string;
} {
  const lines = prep?.wealthEstimate?.assumptions ?? [];
  let comp: string | undefined;
  let carryRealised: string | undefined;
  let carryUnrealised: string | undefined;
  for (const l of lines) {
    if (l.category === "carry_equity" && l.amount) {
      const r = `${fmtUsd(l.amount.low)}–${fmtUsd(l.amount.high)}`;
      // A carry line flagged `liquid` has been realised/cashed → it's income;
      // an unflagged (illiquid) one is still an unrealised asset.
      if (l.liquid) {
        if (!carryRealised) carryRealised = r;
      } else if (!carryUnrealised) {
        carryUnrealised = r;
      }
    }
    // role_comp is base + bonus COMBINED — never label it as salary alone.
    if (l.category === "role_comp" && l.annual && !comp) {
      comp = `${fmtUsd(l.annual.low)}–${fmtUsd(l.annual.high)}/yr`;
    }
  }
  return { comp, carryRealised, carryUnrealised };
}

interface Line {
  label: string;
  hint?: string;
}
interface Group {
  title: string;
  lines: Line[];
  /** A group-level caption (e.g. the combined comp estimate). */
  note?: string;
}

export function MeetingFactFind({ prep }: { prep?: PrepPack }) {
  const ant = anticipated(prep);
  const groups: Group[] = [
    {
      title: "Income",
      note: ant.comp ? `Est. total comp ≈ ${ant.comp} (salary + bonus combined — split with the client)` : undefined,
      lines: [
        { label: "Salary" },
        { label: "Bonus" },
        { label: "Carried interest (realised)", hint: ant.carryRealised ? `est. ${ant.carryRealised}` : undefined },
        { label: "Co-invest income" },
      ],
    },
    { title: "Expenditure", lines: [{ label: "Annual expenditure" }] },
    {
      title: "Assets",
      lines: [
        { label: "Liquid assets" },
        { label: "Investible assets" },
        { label: "Investment assets" },
        { label: "Carried interest (unrealised)", hint: ant.carryUnrealised ? `est. ${ant.carryUnrealised}` : undefined },
        { label: "Co-invest" },
        { label: "Primary residence" },
      ],
    },
    {
      title: "Liabilities",
      lines: [
        { label: "Outstanding loans" },
        { label: "Mortgage" },
        { label: "Future fund commitments" },
      ],
    },
  ];

  return (
    <section className="border border-border bg-card p-6 print:border-0 print:p-0">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="w-4 h-4 text-primary" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Meeting fact-find</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Capture these in the meeting — they complete the Source of Wealth afterwards. Where we
        have an estimate, confirm the real figure.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 pb-1 border-b border-border">
              {g.title}
            </div>
            {g.note && <p className="text-xs text-primary/80 mb-2">{g.note}</p>}
            <ul className="space-y-1.5">
              {g.lines.map((l) => (
                <li key={l.label} className="flex items-baseline gap-2 text-sm">
                  <span className="inline-block w-3.5 h-3.5 shrink-0 rounded-sm border border-muted-foreground/40 translate-y-0.5" />
                  <span className="text-foreground">{l.label}</span>
                  {l.hint && (
                    <span className="text-xs text-primary/80 tabular-nums">· {l.hint}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
