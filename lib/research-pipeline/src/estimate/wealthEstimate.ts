// ============================================================================
// Net-worth estimator + orchestrator.
//
// Flow: choose model (Sonnet by default; Opus when the case is complex) → the
// model emits a grounded assumption LEDGER (never a prose number) → compute the
// ranges in code → an independent model validates each line → reconcile (drop
// ungrounded lines, widen, downgrade confidence). If Sonnet's estimate looks
// shaky, escalate to Opus once. Returns undefined when Claude isn't configured.
// ============================================================================

import { anthropicConfigured, writeWithClaude } from "../write/anthropic";
import { validateWealthEstimate } from "../verify/wealthEstimate";
import { computeEstimate, rollUpConfidence } from "./compute";
import type {
  AssumptionBasis,
  AssumptionCategory,
  AssumptionLine,
  Confidence,
  MoneyRange,
  WealthEstimate,
  WealthValidation,
} from "../types";

// Default Sonnet; escalate to Opus for hard cases. Both overridable.
const SIMPLE_MODEL = process.env.WEALTH_ESTIMATOR_MODEL ?? "claude-sonnet-4-6";
const COMPLEX_MODEL = process.env.WEALTH_ESTIMATOR_MODEL_COMPLEX ?? "claude-opus-4-8";

const CATEGORIES: AssumptionCategory[] = [
  "reported_net_worth", "role_comp", "carry_equity", "liquidity_event", "known_asset",
  "savings_rate", "investment_return", "tax", "illiquidity", "other",
];
const BASES: AssumptionBasis[] = ["from-source", "benchmark-table", "benchmark-inferred", "assumption"];

const ESTIMATOR_INSTRUCTIONS = [
  "You are a senior private banker estimating a UHNW prospect's net worth to validate what size of account is plausible. Your estimate must be DEFENSIBLE — never invent figures. You do NOT write a number; you build a LEDGER of grounded assumptions, and our system computes the ranges from it.",
  "",
  "Method: from the SOURCE MATERIAL and the banker's notes, establish the prospect's roles, seniority, firms, tenure and geography. Then build the ledger:",
  "- If the SOURCE MATERIAL reports a credible TOTAL net-worth figure (e.g. a rich-list valuation), add it as a `reported_net_worth` line with a one-off AMOUNT range. IMPORTANT: when you do this, do NOT separately itemise the operating-company stake or the accumulated salary that MAKE UP that net worth — those are the SAME wealth and would double-count. Model EITHER the top-down reported figure OR the bottom-up build, not both for the total. Prefer the reported figure when one exists; you may still record comp lines, but understand they inform the LIQUID estimate, not an addition to the total.",
  "- Income streams as role_comp (base + bonus) and carry_equity (carried interest / equity / RSUs): give an ANNUAL range and the number of YEARS.",
  "- One-off items as liquidity_event (exit / IPO / sale) and known_asset (property, shareholding): give a one-off AMOUNT and whether it is liquid.",
  "- Modelling parameters as tax, savings_rate, investment_return: give a rate (0..1).",
  "",
  "Tag every line with a basis: 'from-source' (a figure actually stated in the SOURCE MATERIAL — cite its passage index like [3] in sourceRef), 'benchmark-inferred' (a comp band you infer from the role/industry/era — name the comparable in the label), or 'assumption' (a modelling parameter). Be honest: only use 'from-source' when the number is really in the material. Give each line a confidence (high/medium/low).",
  "",
  "Set currency to the most relevant ISO code (GBP for UK, USD for US). Write a one-line `headline` summarising the basis (e.g. '≈18 yrs as a PE managing partner; comp extrapolation plus a reported 2019 stake sale').",
  "",
  "If there is genuinely no anchor — no role/tenure AND no stated asset or wealth figure — set refused=true with a one-line refusalReason rather than inventing an estimate. Otherwise estimate, using wide ranges and low confidence when evidence is thin.",
  "",
  "Return ONLY JSON (no markdown):",
  '{ "refused": false, "refusalReason": "", "currency": "GBP", "headline": "…", "assumptions": [ { "id":"a1", "label":"Reported net worth (rich-list)", "category":"reported_net_worth", "amount":{"low":6000000000,"base":7000000000,"high":9000000000}, "basis":"from-source", "sourceRef":"[1]", "confidence":"medium" }, { "id": "a2", "label": "Base+bonus, MD at <firm>, 2012–2024", "category": "role_comp", "annual": {"low":800000,"base":1200000,"high":1800000}, "years": 12, "basis": "benchmark-inferred", "sourceRef": "[3]", "confidence": "medium" }, { "id":"a3", "label":"Effective tax rate", "category":"tax", "rate":0.45, "basis":"assumption", "sourceRef":"", "confidence":"high" }, { "id":"a4", "label":"2019 sale of stake in <co>", "category":"liquidity_event", "amount":{"low":30000000,"base":40000000,"high":50000000}, "liquid":true, "basis":"from-source", "sourceRef":"[5]", "confidence":"high" } ] }. Give every assumption a UNIQUE id.',
].join("\n");

function chooseComplex(corpusBlock: string, notes: string): boolean {
  const text = `${corpusBlock} ${notes}`.toLowerCase();
  let score = 0;
  if (corpusBlock.length > 12_000) score += 1;
  if (/(trust|foundation|offshore|spv|holding company)/.test(text)) score += 1;
  const events = (text.match(/\b(sold|sale|ipo|acquired|acquisition|exit|merger|float)\b/g) ?? []).length;
  if (events >= 2) score += 1;
  if (/(billion|\bbn\b)/.test(text)) score += 1;
  return score >= 2;
}

function coerceCategory(v: unknown): AssumptionCategory {
  return CATEGORIES.includes(v as AssumptionCategory) ? (v as AssumptionCategory) : "other";
}
function coerceBasis(v: unknown): AssumptionBasis {
  // Unknown ⇒ "assumption" (the weakest, so it widens the band — fail safe).
  return BASES.includes(v as AssumptionBasis) ? (v as AssumptionBasis) : "assumption";
}
function coerceConfidence(v: unknown): Confidence {
  return v === "high" || v === "medium" || v === "low" ? v : "low";
}
function coerceRange(v: unknown, currency: string): MoneyRange | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  const num = (x: unknown): number | undefined => (typeof x === "number" && Number.isFinite(x) ? x : undefined);
  const low = num(r.low);
  const base = num(r.base);
  const high = num(r.high);
  if (low === undefined && base === undefined && high === undefined) return undefined;
  const b = base ?? low ?? high ?? 0;
  const lo0 = low ?? b;
  const hi0 = high ?? b;
  // Guarantee low <= base <= high by EXPANDING the bounds to include base (not
  // clamping base away) — so a mis-ordered reply can't display base outside the
  // range, while a legitimate out-of-bound base (e.g. a negative loss with
  // low=high=0) is preserved rather than erased. base is one of the three
  // values, so it always lands within [min, max].
  const lo = Math.min(lo0, b, hi0);
  const hi = Math.max(lo0, b, hi0);
  return {
    low: lo,
    base: b,
    high: hi,
    currency: typeof r.currency === "string" ? r.currency : currency,
  };
}

interface DraftedLedger {
  refused: boolean;
  refusalReason: string;
  currency: string;
  headline: string;
  lines: AssumptionLine[];
}

function parseLedger(text: string): DraftedLedger | null {
  let raw: Record<string, any>;
  try {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    raw = JSON.parse(s >= 0 && e >= 0 ? text.slice(s, e + 1) : text);
  } catch {
    return null;
  }
  const currency = typeof raw.currency === "string" ? raw.currency : "GBP";
  const lines: AssumptionLine[] = Array.isArray(raw.assumptions)
    ? (raw.assumptions as Record<string, any>[])
        .map((l, i): AssumptionLine => ({
          id: typeof l.id === "string" && l.id.trim() ? l.id : `a${i + 1}`,
          label: typeof l.label === "string" ? l.label : "",
          category: coerceCategory(l.category),
          annual: coerceRange(l.annual, currency),
          years: typeof l.years === "number" ? l.years : undefined,
          amount: coerceRange(l.amount, currency),
          liquid: typeof l.liquid === "boolean" ? l.liquid : undefined,
          rate: typeof l.rate === "number" ? l.rate : undefined,
          basis: coerceBasis(l.basis),
          sourceRef: typeof l.sourceRef === "string" ? l.sourceRef : "",
          confidence: coerceConfidence(l.confidence),
        }))
        .filter((l) => l.label.trim().length > 0)
    : [];

  // Guarantee unique line ids: the validator keys verdicts by id in a Map, so a
  // duplicate id (even if the model emits one) would silently overwrite a line's
  // verdict. Suffix collisions.
  const seenIds = new Set<string>();
  for (const l of lines) {
    let id = l.id;
    let n = 2;
    while (seenIds.has(id)) id = `${l.id}-${n++}`;
    l.id = id;
    seenIds.add(id);
  }

  return {
    refused: raw.refused === true,
    refusalReason: typeof raw.refusalReason === "string" ? raw.refusalReason : "",
    currency,
    headline: typeof raw.headline === "string" ? raw.headline : "",
    lines,
  };
}

async function draftLedger(args: {
  subject: string;
  segment?: string;
  notes: string;
  corpusBlock: string;
  model: string;
}): Promise<DraftedLedger | null> {
  const input = [
    `Prospect: ${args.subject}`,
    args.segment ? `Segment: ${args.segment}` : "",
    "",
    "Banker's notes / profile:",
    args.notes,
    "",
    "SOURCE MATERIAL:",
    args.corpusBlock || "(none)",
  ]
    .filter(Boolean)
    .join("\n");

  let text: string;
  try {
    text = await writeWithClaude({
      instructions: ESTIMATOR_INSTRUCTIONS,
      input,
      model: args.model,
      maxTokens: 4000,
    });
  } catch {
    return null;
  }
  return parseLedger(text);
}

const CONF_ORDER: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
function minConfidence(a: Confidence, b: Confidence): Confidence {
  return CONF_ORDER[a] <= CONF_ORDER[b] ? a : b;
}

function widenRange(r: MoneyRange, factor: number): MoneyRange {
  return { ...r, low: Math.round(r.low / factor), high: Math.round(r.high * factor) };
}

function assemble(drafted: DraftedLedger, model: string): WealthEstimate {
  const { total, liquid, weakFraction } = computeEstimate(drafted.lines, drafted.currency);
  return {
    totalNetWorth: total,
    liquidNetWorth: liquid,
    headline: drafted.headline,
    assumptions: drafted.lines,
    overallConfidence: rollUpConfidence(drafted.lines, weakFraction),
    estimatorModel: model,
    currency: drafted.currency,
    asOf: new Date().toISOString().slice(0, 10),
    generatedAt: new Date().toISOString(),
  };
}

/** Apply the validator's verdicts: annotate lines, drop the ungrounded ones from
 * the computation, widen / downgrade as advised. */
function reconcile(estimate: WealthEstimate, validation: WealthValidation): WealthEstimate {
  const byId = new Map(validation.lineVerdicts.map((v) => [v.id, v]));
  const annotated = estimate.assumptions.map((l) => {
    const v = byId.get(l.id);
    if (!v) return l;
    return {
      ...l,
      validatorNote: v.note || undefined,
      confidence: v.suggestedConfidence ?? l.confidence,
    };
  });
  const isRejected = (l: AssumptionLine): boolean => {
    const v = byId.get(l.id);
    return !!v && (v.verdict === "ungrounded" || v.verdict === "implausible");
  };

  // Drop the rejected lines; a surviving reported anchor (or surviving grounded
  // components) still drives the recomputed estimate.
  const reportedLines = annotated.filter((l) => l.category === "reported_net_worth");
  const surviving = annotated.filter((l) => !isRejected(l));

  let { total, liquid, weakFraction } = computeEstimate(surviving, estimate.currency);

  // Withhold ONLY when the validator rejected every reported figure AND no
  // COMPUTABLE value line survives to fall back on — i.e. nothing computeEstimate
  // would actually count (a role_comp without annual/years, or an asset without
  // amount, contributes nothing). If a real component survives we keep its
  // (partial) estimate, even if it centres on zero.
  const isComputableValue = (l: AssumptionLine): boolean =>
    ((l.category === "role_comp" || l.category === "carry_equity") &&
      !!l.annual &&
      typeof l.years === "number" &&
      l.years > 0) ||
    ((l.category === "liquidity_event" || l.category === "known_asset") && !!l.amount);
  const survivingValueLines = surviving.filter(isComputableValue);
  const lostAllReported = reportedLines.length > 0 && reportedLines.every(isRejected);
  if (lostAllReported && survivingValueLines.length === 0) {
    const zero: MoneyRange = { low: 0, base: 0, high: 0, currency: estimate.currency };
    return {
      ...estimate,
      assumptions: annotated,
      totalNetWorth: zero,
      liquidNetWorth: zero,
      overallConfidence: "low",
      refused: true,
      refusalReason:
        "The reported net-worth figure could not be independently corroborated, so no defensible estimate is shown.",
      validation,
    };
  }
  if (validation.rangeAdvice === "widen" || validation.overConfident) {
    total = widenRange(total, 1.25);
    liquid = widenRange(liquid, 1.25);
  }
  let confidence = minConfidence(
    rollUpConfidence(surviving, weakFraction),
    validation.overallConfidence,
  );
  if (validation.flaggedCount >= 2) confidence = "low";

  return {
    ...estimate,
    assumptions: annotated,
    totalNetWorth: total,
    liquidNetWorth: liquid,
    overallConfidence: confidence,
    validation,
  };
}

function shouldEscalate(estimate: WealthEstimate, validation: WealthValidation): boolean {
  return validation.flaggedCount >= 2 || estimate.overallConfidence === "low";
}

export interface EstimateWealthArgs {
  subject: string;
  segment?: string;
  notes: string;
  /** Numbered, source-attributed corpus block (from corpusToPromptBlock). */
  corpusBlock: string;
  /** The same source text fed to the validator (usually the prep `input`). */
  sourceText: string;
}

export async function estimateWealth(
  args: EstimateWealthArgs,
): Promise<WealthEstimate | undefined> {
  // Estimation leans on the strong writer — skip cleanly if Claude isn't set.
  if (!anthropicConfigured()) return undefined;

  const model = chooseComplex(args.corpusBlock, args.notes) ? COMPLEX_MODEL : SIMPLE_MODEL;

  const drafted = await draftLedger({ ...args, model });
  if (!drafted) return undefined;

  if (drafted.refused || drafted.lines.length === 0) {
    return {
      totalNetWorth: { low: 0, base: 0, high: 0, currency: drafted?.currency ?? "GBP" },
      liquidNetWorth: { low: 0, base: 0, high: 0, currency: drafted?.currency ?? "GBP" },
      headline: "",
      assumptions: [],
      overallConfidence: "low",
      estimatorModel: model,
      refused: true,
      refusalReason:
        drafted.refusalReason || "Insufficient public evidence to estimate net worth.",
      currency: drafted.currency ?? "GBP",
      asOf: new Date().toISOString().slice(0, 10),
      generatedAt: new Date().toISOString(),
    };
  }

  let estimate = assemble(drafted, model);
  const validation = await validateWealthEstimate(estimate.assumptions, args.sourceText);
  if (validation) estimate = reconcile(estimate, validation);

  // Self-escalation: a shaky Sonnet estimate gets one Opus re-run.
  if (model === SIMPLE_MODEL && validation && shouldEscalate(estimate, validation)) {
    const opusDraft = await draftLedger({ ...args, model: COMPLEX_MODEL });
    if (opusDraft && !opusDraft.refused && opusDraft.lines.length > 0) {
      let opusEstimate = assemble(opusDraft, COMPLEX_MODEL);
      const opusValidation = await validateWealthEstimate(opusEstimate.assumptions, args.sourceText);
      if (opusValidation) opusEstimate = reconcile(opusEstimate, opusValidation);
      estimate = opusEstimate;
    }
  }

  return estimate;
}
