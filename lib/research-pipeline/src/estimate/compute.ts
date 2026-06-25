// ============================================================================
// Deterministic net-worth computation — the auditable heart of the estimator.
//
// The model supplies a ledger of grounded inputs; THIS module does all the
// arithmetic, so a number can never be a model hallucination — only a sum of
// declared, source-tagged lines. Pure functions, no I/O, unit-testable.
// ============================================================================

import type { AssumptionLine, Confidence, MoneyRange, QualificationVerdict } from "../types";

/** The wealth bar a prospect must clear to be worth pursuing (USD). Banker rule:
 * the upper bound is irrelevant — clearing $25M is the only qualification. */
export const QUALIFY_THRESHOLD = 25_000_000;

const DEFAULTS = {
  tax: 0.45, // UK additional-rate ballpark
  savings: 0.35, // fraction of after-tax income retained as wealth
  annualReturn: 0.05, // real annual return on retained wealth
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Round to 2 significant figures so ranges read cleanly (£180M, not £183.4M). */
function round2sig(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  const mag = Math.floor(Math.log10(Math.abs(n)));
  const factor = Math.pow(10, mag - 1);
  return Math.round(n / factor) * factor;
}

function pickRate(lines: AssumptionLine[], category: string, fallback: number): number {
  const l = lines.find((x) => x.category === category && typeof x.rate === "number");
  if (!l || typeof l.rate !== "number") return fallback;
  const max = category === "investment_return" ? 0.5 : 1;
  return clamp(l.rate, 0, max);
}

export interface ComputedRanges {
  total: MoneyRange;
  liquid: MoneyRange;
  /** Fraction of lines on a weak basis — drives range widening + confidence. */
  weakFraction: number;
}

/**
 * Compute total + liquid net-worth ranges from the assumption ledger.
 *
 * Income streams (role_comp / carry_equity) accumulate as annual × years, taxed,
 * saved at the savings rate, and grown at the real return over ~half the tenure
 * (a midpoint approximation). Events + held assets add their one-off amounts.
 * Liquid net worth = the accumulated financial wealth (liquid by nature) plus
 * any asset/event explicitly flagged liquid. The band widens as the share of
 * weakly-grounded lines rises.
 */
export function computeEstimate(lines: AssumptionLine[], currency: string): ComputedRanges {
  const tax = pickRate(lines, "tax", DEFAULTS.tax);
  const savings = pickRate(lines, "savings_rate", DEFAULTS.savings);
  const annualReturn = pickRate(lines, "investment_return", DEFAULTS.annualReturn);

  let accLow = 0;
  let accBase = 0;
  let accHigh = 0;
  for (const l of lines) {
    if ((l.category !== "role_comp" && l.category !== "carry_equity") || !l.annual) continue;
    const yrs = clamp(typeof l.years === "number" ? l.years : 0, 0, 60);
    if (yrs <= 0) continue;
    const growth = Math.pow(1 + annualReturn, yrs / 2);
    const factor = (1 - tax) * savings * growth;
    accLow += Math.max(0, l.annual.low) * yrs * factor;
    accBase += Math.max(0, l.annual.base) * yrs * factor;
    accHigh += Math.max(0, l.annual.high) * yrs * factor;
  }

  let evLow = 0;
  let evBase = 0;
  let evHigh = 0;
  let liqEvLow = 0;
  let liqEvBase = 0;
  let liqEvHigh = 0;
  for (const l of lines) {
    if ((l.category !== "liquidity_event" && l.category !== "known_asset") || !l.amount) continue;
    // A known asset can't be worth less than zero, but a liquidity_event can be
    // NEGATIVE — a loss (e.g. wealth destroyed in a collapsed deal) — and must
    // subtract from the estimate rather than be clamped away.
    const floor = l.category === "known_asset" ? 0 : Number.NEGATIVE_INFINITY;
    const lo = Math.max(floor, l.amount.low);
    const ba = Math.max(floor, l.amount.base);
    const hi = Math.max(floor, l.amount.high);
    evLow += lo;
    evBase += ba;
    evHigh += hi;
    if (l.liquid) {
      liqEvLow += lo;
      liqEvBase += ba;
      liqEvHigh += hi;
    }
  }

  // Top-down anchor: a credible reported TOTAL net-worth figure (a rich-list
  // valuation) is a current, comprehensive snapshot — it already subsumes the
  // operating-company stake, held assets and the wealth the accumulated comp
  // built. So when one is present we DELIBERATELY anchor total on it rather than
  // summing the components, which would double-count the same wealth (the bug
  // this guards against). The component lines instead inform the LIQUID estimate.
  // With no reported figure we build the total bottom-up from the components.
  // Anchor on ANY reported total, including a non-positive one: a genuinely
  // zero/negative reported net worth (e.g. a bankrupt prospect) should floor the
  // estimate to ~0, NOT be dropped so the bottom-up comp model overstates them.
  const reported = lines.filter((l) => l.category === "reported_net_worth" && l.amount);

  let totalLow: number;
  let totalBase: number;
  let totalHigh: number;
  if (reported.length > 0) {
    totalLow = Math.min(...reported.map((l) => l.amount!.low));
    totalHigh = Math.max(...reported.map((l) => l.amount!.high));
    totalBase = reported.reduce((s, l) => s + l.amount!.base, 0) / reported.length;
  } else {
    // No reported figure — build bottom-up: accumulated comp + events + assets.
    totalLow = accLow + evLow;
    totalBase = accBase + evBase;
    totalHigh = accHigh + evHigh;
  }
  // Liquid is always bottom-up: accumulated financial wealth (liquid by nature)
  // plus only the assets/events explicitly flagged liquid — never the reported
  // total (which bundles the illiquid operating stake).
  const liquidLow = accLow + liqEvLow;
  const liquidBase = accBase + liqEvBase;
  const liquidHigh = accHigh + liqEvHigh;

  const weak = lines.filter(
    (l) => l.basis === "benchmark-inferred" || l.basis === "assumption",
  ).length;
  const weakFraction = lines.length ? weak / lines.length : 1;
  // Up to +50% widening here when the ledger leans on inference. (Note: the
  // validator's reconcile step may widen once more by ×1.25 when it judges the
  // estimate over-confident, so a weak + flagged ledger can widen beyond +50%.)
  const widen = 1 + weakFraction * 0.5;

  // Net worth floors at zero (losses can drive the raw figure negative).
  const floor0 = (n: number) => Math.max(0, n);
  const total: MoneyRange = {
    low: floor0(round2sig(totalLow / widen)),
    base: floor0(round2sig(totalBase)),
    high: floor0(round2sig(totalHigh * widen)),
    currency,
  };
  // Liquid net worth is a subset of total — cap every component at the total so
  // an anchored (top-down) total can never be exceeded by bottom-up liquid.
  const liquid: MoneyRange = {
    low: Math.min(floor0(round2sig(liquidLow / widen)), total.low),
    base: Math.min(floor0(round2sig(liquidBase)), total.base),
    high: Math.min(floor0(round2sig(liquidHigh * widen)), total.high),
    currency,
  };

  return { total, liquid, weakFraction };
}

/**
 * Classify a computed total against the qualification threshold. We compare on
 * the *range*, not the base: only when the conservative low end already clears
 * the bar is it an unequivocal "above"; only when even the high end falls short
 * is it "below"; anything straddling the bar is "borderline" — confirm live.
 */
export function qualify(total: MoneyRange, threshold: number): QualificationVerdict {
  if (total.low >= threshold) return "above";
  if (total.high < threshold) return "below";
  return "borderline";
}

/** Roll the ledger's basis + per-line confidence mix up to one confidence. */
export function rollUpConfidence(lines: AssumptionLine[], weakFraction: number): Confidence {
  const lows = lines.filter((l) => l.confidence === "low").length;
  if (weakFraction > 0.6 || lows >= 3) return "low";
  if (weakFraction > 0.3 || lows >= 1) return "medium";
  return "high";
}
