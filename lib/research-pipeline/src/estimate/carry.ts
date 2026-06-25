// ============================================================================
// Carried-interest estimator — the financial-sponsor wealth path.
//
// For PE / hedge-fund principals, the dominant wealth driver is carried interest,
// not salary. Per banker (Rupert) guidance, carry is estimable from a small set
// of inputs:
//
//   net carry = fund_size × (gross_multiple − 1) × carry_pool_rate
//                         × personal_carry_pct × (1 − carry_tax_rate)
//
// The MODEL supplies the grounded inputs (fund size from research; seniority →
// carry points from OUR table below); THIS code does the arithmetic, so the
// number is never a hallucination — it's a transparent, editable computation the
// banker can use as a conversation hook ("you were a partner ~12 yrs, that's
// roughly $X of carry — does that fit?"). Pure functions, no I/O.
// ============================================================================

import type { Band, CarrySpec, MoneyRange } from "../types";

export type { Band, CarrySpec } from "../types";

/** Industry-standard defaults — overridable per line when research says otherwise. */
export const CARRY_DEFAULTS = {
  /** GP share of fund profits. 20% is the long-standing standard. */
  carryPoolRate: 0.2,
  /** Carried interest tax rate. Rupert: "taxed at 20–24%." */
  taxRate: 0.22,
  /** Profit multiple over invested capital when research gives no figure. */
  grossMultiple: { low: 1.5, base: 2.0, high: 2.5 } as Band,
};

/**
 * OUR carry-points table by seniority/tenure (personal share of the GP carry
 * pool). ASSUMPTIONS — to validate with the client. Calibrated against Rupert's
 * worked examples (Tower Brook senior partner = 4.5% on a ~$3bn fund; a ~10-yr
 * joiner ≈ 5% upper end). Keyed by a coarse seniority tier the model picks.
 */
export type CarryTier =
  | "founder_managing_partner"
  | "senior_partner"
  | "partner"
  | "principal"
  | "vp_mid"
  | "junior"
  | "lateral_signon";

export const CARRY_POINTS_TABLE: Record<CarryTier, Band> = {
  // Founders hold the lion's share of the GP pool.
  founder_managing_partner: { low: 0.15, base: 0.2, high: 0.3 },
  // Rupert: Tower Brook senior partner = 4.5%.
  senior_partner: { low: 0.04, base: 0.05, high: 0.06 },
  partner: { low: 0.02, base: 0.03, high: 0.04 },
  // Rupert: "joined ~10 yrs ago ≈ 5%" sits at this tier's upper edge.
  principal: { low: 0.01, base: 0.015, high: 0.02 },
  vp_mid: { low: 0.0025, base: 0.005, high: 0.01 },
  junior: { low: 0, base: 0.001, high: 0.0025 },
  // A lateral hire's sign-on grant on an existing/mature fund.
  lateral_signon: { low: 0.0025, base: 0.00375, high: 0.005 },
};

/** Common model phrasings → canonical tier. The estimator prompt asks for the
 * enum, but LLM JSON drifts (casing, separators, near-synonyms); we normalise
 * those rather than dropping a real carry line. */
const TIER_SYNONYMS: Record<string, CarryTier> = {
  founder: "founder_managing_partner",
  founding_partner: "founder_managing_partner",
  managing_partner: "founder_managing_partner",
  manager_partner: "founder_managing_partner",
  senior_managing_director: "senior_partner",
  partner_senior: "senior_partner",
  principal_partner: "principal",
  vice_president: "vp_mid",
  vp: "vp_mid",
  mid: "vp_mid",
  associate: "junior",
  analyst: "junior",
  lateral: "lateral_signon",
  signon: "lateral_signon",
  sign_on: "lateral_signon",
};

/** Look up the carry-points band for a tier. Tolerates casing/separator drift and
 * common synonyms; returns undefined only for a genuinely unrecognised tier — we
 * FAIL CLOSED there rather than guess (a silent wrong default would be treated as
 * a code-derived number by the UI/validator). */
export function carryPointsForTier(tier: string): Band | undefined {
  const key = tier.trim().toLowerCase().replace(/[\s/&-]+/g, "_").replace(/^_+|_+$/g, "");
  if (CARRY_POINTS_TABLE[key as CarryTier]) return CARRY_POINTS_TABLE[key as CarryTier];
  const syn = TIER_SYNONYMS[key];
  return syn ? CARRY_POINTS_TABLE[syn] : undefined;
}

/** Round to the nearest $100k so per-line figures read cleanly. */
function round100k(n: number): number {
  return Math.round(n / 100_000) * 100_000;
}

/**
 * Compute the net (after-tax) carried-interest value for one fund as a USD range.
 * The low/base/high pair the conservative and optimistic ends of the two
 * genuinely uncertain factors — the profit multiple and the personal carry
 * points — so the band reflects real estimation uncertainty, not noise.
 */
export function carryNetRange(spec: CarrySpec): MoneyRange {
  const pool = spec.carryPoolRate ?? CARRY_DEFAULTS.carryPoolRate;
  const tax = spec.taxRate ?? CARRY_DEFAULTS.taxRate;
  const mult = spec.grossMultiple ?? CARRY_DEFAULTS.grossMultiple;
  const fund = Math.max(0, spec.fundSizeUsd);
  const pct = spec.personalCarryPct;
  const net = (m: number, p: number) =>
    round100k(fund * Math.max(0, m - 1) * pool * Math.max(0, p) * (1 - tax));
  return {
    low: net(mult.low, pct.low),
    base: net(mult.base, pct.base),
    high: net(mult.high, pct.high),
    currency: "USD",
  };
}
