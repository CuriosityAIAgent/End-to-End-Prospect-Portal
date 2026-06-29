// ============================================================================
// Sourced PE compensation & carried-interest benchmarks.
//
// Per banker (Rupert): published comp surveys are good enough for onboarding to
// agree that a partner at a fund of a given AuM is worth a certain amount. We
// inject these ranges into the wealth estimator so its role_comp / carry lines
// for financial sponsors are grounded in real survey data (cited), not guessed —
// and so the banker can defend the number ("per ExecCapital 2026, a partner at a
// mid-market fund earns $0.7–2.0m cash, plus carry").
//
// All figures normalised to USD (GBP converted at ≈1.27). As-of 2025–2026.
// Ranges are for an ESTABLISHED MID-MARKET fund ($200m–$1bn / £-equivalent):
// smaller / emerging managers sit at the low end; large-cap and mega-funds
// (KKR / Blackstone / Apollo tier) are materially above the high end.
// ============================================================================

export interface PeCompSource {
  name: string;
  url: string;
  asOf: string;
  covers: string;
}

export const PE_COMP_SOURCES: PeCompSource[] = [
  {
    name: "ExecCapital — PE Salary Guide",
    url: "https://www.execcapital.co.uk/private-equity-salary-guide/",
    asOf: "2026",
    covers: "Base salary + cash bonus by seniority for UK mid-market buyout funds (£200m–£1bn).",
  },
  {
    name: "Mergers & Inquisitions — Private Equity Partner",
    url: "https://mergersandinquisitions.com/private-equity-partner/",
    asOf: "2025",
    covers: "Partner base+bonus ($0.7–2.0m) and personal carry share of the 20% pool by fund size.",
  },
  {
    name: "PE Professional — 2025 Carried Interest & Compensation Survey",
    url: "https://peprofessional.com/2025-carried-interest-and-compensation-survey/",
    asOf: "2025",
    covers: "327-fund survey of comp + carry across 11 employee classes by fund size (membership).",
  },
];

/** Total cash compensation (base + bonus), USD, keyed by the estimator's carry
 *  seniority tiers so the two models line up. */
export const PE_CASH_COMP_USD: Record<
  string,
  { low: number; base: number; high: number; comparable: string }
> = {
  junior: { low: 100_000, base: 200_000, high: 350_000, comparable: "Analyst / Associate" },
  vp_mid: { low: 330_000, base: 550_000, high: 840_000, comparable: "Senior Associate / VP" },
  principal: { low: 460_000, base: 750_000, high: 1_220_000, comparable: "Principal / Director" },
  partner: { low: 700_000, base: 1_200_000, high: 2_000_000, comparable: "Partner / MD" },
  senior_partner: { low: 900_000, base: 1_500_000, high: 2_500_000, comparable: "Senior Partner" },
  founder_managing_partner: {
    low: 1_000_000,
    base: 2_000_000,
    high: 4_000_000,
    comparable: "Founder / Managing Partner",
  },
};

/** M&I: a normal Partner/MD personally holds ~0.3–0.7% of the GP carry pool on a
 *  $1–10bn fund. Reference only — NOT used to price carry (the estimator prices
 *  carry from carry.ts's Rupert-calibrated CARRY_POINTS_TABLE, which is higher;
 *  the divergence is a known source disagreement, surfaced here for context). */
export const PE_CARRY_PERSONAL_PCT_PARTNER = { low: 0.003, base: 0.005, high: 0.007 };

const usd = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}m` : `$${Math.round(n / 1000)}k`);

/** A compact, sourced reference block for injection into the estimator prompt. */
export function peCompReference(): string {
  // Render each row keyed by the canonical carry tier (the exact string the
  // estimator must put in carry.seniorityTier — so it round-trips through
  // carryPointsForTier).
  const rows = Object.entries(PE_CASH_COMP_USD)
    .map(([tier, c]) => `  - ${tier} (${c.comparable}): total cash ${usd(c.low)}–${usd(c.high)} (≈${usd(c.base)} typical)`)
    .join("\n");
  const sources = PE_COMP_SOURCES.map((s) => `${s.name} (${s.asOf})`).join("; ");
  return [
    "PRIVATE EQUITY CASH-COMP BENCHMARKS (USD; established mid-market $200m–$1bn funds — scale UP for large-cap / mega-funds, DOWN for emerging managers; PE only, NOT hedge funds). The leading word on each line is the exact seniorityTier value to use:",
    rows,
    "  - Carried interest: add a carry_equity line with fundSizeUsd and a seniorityTier matched to role/tenure (use lateral_signon for a sign-on grant on a mature fund) — OUR carry table prices it; do NOT state a carry percentage here.",
    `  Sources: ${sources}. Cite the source name in the line label (e.g. "per ExecCapital 2026").`,
  ].join("\n");
}
