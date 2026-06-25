// ============================================================================
// Assumptions → client-validation questions.
//
// The banker's idea: every material assumption behind the estimate becomes a
// question to confirm with the client ("we assumed X — is that right?"). This
// turns the estimate's ledger into Source-of-Wealth questions, reusing the
// existing SowQuestion shape so the prep panel renders them with no changes.
// ============================================================================

import { SOW_EVIDENCE_REFERENCE } from "../reference/sowEvidence";
import type { AssumptionLine, MoneyRange, SowQuestion, WealthEstimate } from "../types";

function fmtAmount(n: number, currency: string): string {
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sym}${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}bn`;
  if (abs >= 1_000_000) return `${sym}${Math.round(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${sym}${Math.round(n / 1_000)}k`;
  return `${sym}${Math.round(n)}`;
}

function fmtRange(r: MoneyRange): string {
  return `${fmtAmount(r.low, r.currency)}–${fmtAmount(r.high, r.currency)}`;
}

function sowCategoryFor(line: AssumptionLine): string {
  switch (line.category) {
    case "role_comp":
      return "employment";
    case "carry_equity":
      return "compensation";
    case "liquidity_event":
      return "business_sale";
    case "known_asset":
      return /(propert|home|residence|estate|land|flat|house|mansion)/i.test(line.label)
        ? "real_estate"
        : "business_ownership";
    default:
      return "employment";
  }
}

/** Lines worth putting to the client: the value drivers (income, events, assets).
 * Rate/parameter lines are modelling detail, not client questions. */
function isMaterial(line: AssumptionLine): boolean {
  return (
    line.category === "role_comp" ||
    line.category === "carry_equity" ||
    line.category === "liquidity_event" ||
    line.category === "known_asset"
  );
}

/** Rough contribution, for ranking which assumptions matter most. */
function weight(line: AssumptionLine): number {
  if (line.annual) return line.annual.base * (line.years ?? 1);
  if (line.amount) return line.amount.base;
  return 0;
}

export function assumptionsToQuestions(estimate: WealthEstimate, max = 4): SowQuestion[] {
  if (estimate.refused) return [];
  const material = estimate.assumptions
    .filter(isMaterial)
    // A material line with no value (e.g. a carry line whose spec failed to parse,
    // or a role_comp missing its annual range) would yield a malformed question
    // ("…at roughly . Is that right?"); drop those.
    .filter((l) => !!l.annual || !!l.amount)
    .sort((a, b) => weight(b) - weight(a))
    .slice(0, max);

  return material.map((line) => {
    const cat = SOW_EVIDENCE_REFERENCE.find((c) => c.id === sowCategoryFor(line));
    const valueStr = line.annual
      ? `${fmtRange(line.annual)} a year over ~${line.years ?? "?"} years`
      : line.amount
        ? fmtRange(line.amount)
        : "";
    return {
      question: `We've assumed ${line.label.toLowerCase()} at roughly ${valueStr}. Is that broadly right?`,
      why: cat?.establishes ?? "Corroborates a key driver of the net-worth estimate.",
      suggestedAnswer: `Our estimate puts this at ${valueStr} (${line.basis.replace(/-/g, " ")}, ${line.confidence} confidence).`,
      expectedEvidence: cat?.expectedEvidence ?? [],
    };
  });
}
