// ============================================================================
// Deterministic net-worth computation — the auditable heart of the estimator.
//
// The model supplies a ledger of grounded inputs; THIS module does all the
// arithmetic, so a number can never be a model hallucination — only a sum of
// declared, source-tagged lines. Pure functions, no I/O, unit-testable.
// ============================================================================

import type { AssumptionLine, Confidence, MoneyRange } from "../types";

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
    evLow += Math.max(0, l.amount.low);
    evBase += Math.max(0, l.amount.base);
    evHigh += Math.max(0, l.amount.high);
    if (l.liquid) {
      liqEvLow += Math.max(0, l.amount.low);
      liqEvBase += Math.max(0, l.amount.base);
      liqEvHigh += Math.max(0, l.amount.high);
    }
  }

  // Accumulated financial wealth is liquid by nature; assets/events add per flag.
  const totalLow = accLow + evLow;
  const totalBase = accBase + evBase;
  const totalHigh = accHigh + evHigh;
  const liquidLow = accLow + liqEvLow;
  const liquidBase = accBase + liqEvBase;
  const liquidHigh = accHigh + liqEvHigh;

  const weak = lines.filter(
    (l) => l.basis === "benchmark-inferred" || l.basis === "assumption",
  ).length;
  const weakFraction = lines.length ? weak / lines.length : 1;
  // Up to +50% widening when the ledger leans on inference.
  const widen = 1 + weakFraction * 0.5;

  const total: MoneyRange = {
    low: round2sig(totalLow / widen),
    base: round2sig(totalBase),
    high: round2sig(totalHigh * widen),
    currency,
  };
  const liquid: MoneyRange = {
    low: round2sig(liquidLow / widen),
    base: round2sig(liquidBase),
    high: round2sig(Math.min(liquidHigh * widen, total.high)),
    currency,
  };

  return { total, liquid, weakFraction };
}

/** Roll the ledger's basis + per-line confidence mix up to one confidence. */
export function rollUpConfidence(lines: AssumptionLine[], weakFraction: number): Confidence {
  const lows = lines.filter((l) => l.confidence === "low").length;
  if (weakFraction > 0.6 || lows >= 3) return "low";
  if (weakFraction > 0.3 || lows >= 1) return "medium";
  return "high";
}
