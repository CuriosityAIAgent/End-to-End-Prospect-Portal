import {
  Landmark,
  LineChart,
  CandlestickChart,
  Banknote,
  ShieldCheck,
  CalendarClock,
  HeartHandshake,
  Swords,
  type LucideIcon,
} from "lucide-react";

export const meetingTypes = [
  "Prospect first meeting",
  "Prospect follow-up",
  "Client review",
  "Client advisory",
  "Referral intro",
  "Internal",
] as const;

// Selecting one of these means "nothing to record" for a dimension — the
// detail textarea stays hidden and the topic is excluded from the AI enhance
// pass.
export const NULL_VALUES = ["Not discussed", "None identified", "None mentioned"];

export function isCovered(value: string | undefined): boolean {
  return !!value && !NULL_VALUES.includes(value);
}

export interface CoverageOption {
  value: string;
  label: string;
}

export interface CoverageAccent {
  /** icon colour */
  icon: string;
  /** chip / selected-state background + text + border */
  chip: string;
  /** left accent bar */
  bar: string;
  /** soft header tint */
  header: string;
}

export interface CoverageDimension {
  id: string;
  label: string;
  icon: LucideIcon;
  accent: CoverageAccent;
  hint: string;
  options: CoverageOption[];
}

export const coverageDimensions: CoverageDimension[] = [
  {
    id: "wealthAdvisory",
    label: "Wealth Advisory",
    icon: Landmark,
    accent: {
      icon: "text-indigo-600",
      chip: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30",
      bar: "bg-indigo-500",
      header: "bg-indigo-500/5",
    },
    hint: "Long-horizon planning — estate, succession, tax and philanthropy.",
    options: [
      { value: "Not discussed", label: "Not discussed" },
      { value: "Briefly mentioned", label: "Briefly mentioned" },
      { value: "Key focus — estate planning", label: "Estate planning" },
      { value: "Key focus — succession planning", label: "Succession planning" },
      { value: "Key focus — tax planning", label: "Tax planning" },
      { value: "Key focus — philanthropy", label: "Philanthropy" },
      { value: "Key focus — trust structures", label: "Trust structures" },
    ],
  },
  {
    id: "investmentAdvisory",
    label: "Investment Advisory",
    icon: LineChart,
    accent: {
      icon: "text-sky-600",
      chip: "bg-sky-500/10 text-sky-700 border-sky-500/30",
      bar: "bg-sky-500",
      header: "bg-sky-500/5",
    },
    hint: "Portfolio strategy — allocation, risk profile and performance.",
    options: [
      { value: "Not discussed", label: "Not discussed" },
      { value: "Portfolio review", label: "Portfolio review" },
      { value: "Risk profiling / tolerance review", label: "Risk profiling" },
      { value: "Asset allocation review", label: "Asset allocation review" },
      { value: "New investment ideas presented", label: "New investment ideas" },
      { value: "Performance discussion", label: "Performance discussion" },
      { value: "Discretionary mandate discussion", label: "Discretionary mandate" },
    ],
  },
  {
    id: "brokerage",
    label: "Brokerage / Trading",
    icon: CandlestickChart,
    accent: {
      icon: "text-teal-600",
      chip: "bg-teal-500/10 text-teal-700 border-teal-500/30",
      bar: "bg-teal-500",
      header: "bg-teal-500/5",
    },
    hint: "Execution appetite across asset classes and instruments.",
    options: [
      { value: "Not discussed", label: "Not discussed" },
      { value: "Equities", label: "Equities" },
      { value: "Fixed income / bonds", label: "Fixed income / bonds" },
      { value: "FX / currency", label: "FX / currency" },
      { value: "Structured products", label: "Structured products" },
      { value: "Alternatives / private markets", label: "Alternatives / private markets" },
    ],
  },
  {
    id: "banking",
    label: "Banking Services",
    icon: Banknote,
    accent: {
      icon: "text-emerald-600",
      chip: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
      bar: "bg-emerald-500",
      header: "bg-emerald-500/5",
    },
    hint: "Everyday and structured banking — credit, cash and property finance.",
    options: [
      { value: "Not discussed", label: "Not discussed" },
      { value: "Credit & lending facilities", label: "Credit & lending" },
      { value: "Cash management & deposits", label: "Cash management" },
      { value: "Mortgage / property finance", label: "Mortgage / property finance" },
      { value: "Trade finance", label: "Trade finance" },
      { value: "International banking needs", label: "International banking" },
    ],
  },
  {
    id: "protection",
    label: "Protection & Insurance",
    icon: ShieldCheck,
    accent: {
      icon: "text-cyan-600",
      chip: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
      bar: "bg-cyan-500",
      header: "bg-cyan-500/5",
    },
    hint: "Downside cover for the client, family and business interests.",
    options: [
      { value: "Not discussed", label: "Not discussed" },
      { value: "Life cover", label: "Life cover" },
      { value: "Critical illness cover", label: "Critical illness" },
      { value: "Wealth / asset protection", label: "Wealth / asset protection" },
      { value: "Business protection", label: "Business protection" },
      { value: "Income protection", label: "Income protection" },
    ],
  },
  {
    id: "lifeEvents",
    label: "Client Life Events / Triggers",
    icon: CalendarClock,
    accent: {
      icon: "text-violet-600",
      chip: "bg-violet-500/10 text-violet-700 border-violet-500/30",
      bar: "bg-violet-500",
      header: "bg-violet-500/5",
    },
    hint: "Liquidity and planning triggers on the horizon.",
    options: [
      { value: "None identified", label: "None identified" },
      { value: "Business sale / exit", label: "Business sale / exit" },
      { value: "Inheritance received or anticipated", label: "Inheritance" },
      { value: "Approaching / recent retirement", label: "Retirement" },
      { value: "Property purchase or sale", label: "Property transaction" },
      { value: "Divorce / separation", label: "Divorce / separation" },
      { value: "Family expansion", label: "Family expansion" },
      { value: "Relocation / change of domicile", label: "Relocation / domicile change" },
    ],
  },
  {
    id: "relationship",
    label: "Relationship Temperature",
    icon: HeartHandshake,
    accent: {
      icon: "text-amber-600",
      chip: "bg-amber-500/10 text-amber-700 border-amber-500/30",
      bar: "bg-amber-500",
      header: "bg-amber-500/5",
    },
    hint: "Your read on how the relationship is trending.",
    options: [
      { value: "Strong and growing", label: "Strong and growing" },
      { value: "Positive", label: "Positive" },
      { value: "Neutral", label: "Neutral" },
      { value: "Some concerns raised", label: "Some concerns raised" },
      { value: "At risk — requires attention", label: "At risk" },
    ],
  },
  {
    id: "threats",
    label: "Competitive / Relationship Threats",
    icon: Swords,
    accent: {
      icon: "text-rose-600",
      chip: "bg-rose-500/10 text-rose-700 border-rose-500/30",
      bar: "bg-rose-500",
      header: "bg-rose-500/5",
    },
    hint: "Signals a competitor or adviser may be circling.",
    options: [
      { value: "None mentioned", label: "None mentioned" },
      { value: "Another bank or institution mentioned", label: "Competitor bank mentioned" },
      { value: "Adviser or intermediary change planned", label: "Adviser change planned" },
      { value: "Pricing or fee sensitivity raised", label: "Pricing sensitivity" },
      { value: "Dissatisfaction with current service", label: "Service dissatisfaction" },
    ],
  },
];

export interface CoverageEntry {
  value: string;
  detail?: string;
}

export interface FileNoteData {
  meetingType?: string;
  date?: string;
  note?: string;
  coverage?: Record<string, CoverageEntry>;
}

/**
 * The discussion dimensions the banker explicitly engaged with AND whose value
 * is non-null. Shared by the file-note enhance pass and the Source of Wealth
 * draft: sending an untouched default (e.g. Relationship Temperature's "Strong
 * and growing") would feed the model an unconfirmed "fact" it could weave in as
 * if confirmed.
 */
export function engagedCoverage(
  coverage: Record<string, CoverageEntry> | undefined,
): { label: string; value: string; detail?: string }[] {
  if (!coverage) return [];
  return coverageDimensions
    .map((dim) => ({ dim, entry: coverage[dim.id] }))
    .filter(({ entry }) => !!entry && isCovered(entry.value))
    .map(({ dim, entry }) => ({ label: dim.label, value: entry!.value, detail: entry!.detail }));
}
