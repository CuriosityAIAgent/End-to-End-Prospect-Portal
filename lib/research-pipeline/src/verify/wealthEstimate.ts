// ============================================================================
// Independent validator for the net-worth estimate.
//
// A second, independent model (OpenAI) checks the estimator's assumption ledger
// line by line — is each number grounded? plausible? honestly labelled? — and
// the aggregate for over-confidence. It does NOT re-do arithmetic (code owns
// that). Failure is non-fatal: returns undefined and the estimate still ships.
// ============================================================================

import { openai } from "@workspace/integrations-openai-ai-server";
import type {
  AssumptionLine,
  Confidence,
  LineVerdict,
  WealthValidation,
} from "../types";

const VALIDATOR_MODEL = process.env.WEALTH_VALIDATOR_MODEL ?? "gpt-4o-mini";

const VALIDATE_INSTRUCTIONS = [
  "You are an independent risk officer at a private bank. An analyst has produced a NET-WORTH ESTIMATE for a prospect as a ledger of assumption lines, each tagged with a basis and a confidence. You are given the SOURCE MATERIAL they worked from and the LEDGER.",
  "Your job is to stress-test the ledger, line by line. You are the safety net against an over-confident or ungrounded estimate — be sceptical, not generous. Do NOT compute totals; only judge the inputs.",
  "",
  "For each line, return a verdict:",
  '- "ok": the value is grounded (or a fair benchmark) and the confidence is justified.',
  '- "weak": defensible but thin — the confidence is too high for how it is grounded.',
  '- "ungrounded": tagged "from-source" but not actually in the SOURCE MATERIAL, or a number with no credible basis.',
  '- "implausible": the value is unrealistic for the stated role / industry / era / geography.',
  "Give a one-line `note` for each, and a `suggestedConfidence` when you would lower it.",
  "",
  "NOTE on carried-interest (carry_equity) lines: their dollar AMOUNT is computed by our code from the shown inputs [carry: fund size · seniority tier · gross multiple], NOT asserted by the analyst — so do NOT flag the amount as 'ungrounded' merely for lacking a source. Judge instead whether the INPUTS are reasonable: is the fund size right/credible, and does the seniority tier fit the prospect's role and tenure? Flag only if those inputs are wrong or unsupported.",
  "",
  "Then judge the aggregate: is the overall estimate likely OVER-CONFIDENT (too narrow a range for how much rests on inference)? Should the range be widened?",
  "",
  'Return ONLY JSON: {"lineVerdicts":[{"id":"<line id>","verdict":"ok|weak|ungrounded|implausible","note":"...","suggestedConfidence":"high|medium|low"}],"overConfident":true|false,"rangeAdvice":"ok|widen","overallConfidence":"high|medium|low"}. No markdown.',
].join("\n");

function coerceVerdict(v: unknown): LineVerdict {
  return v === "ok" || v === "weak" || v === "ungrounded" || v === "implausible"
    ? v
    : "weak"; // unknown ⇒ weak (fail safe — never silently "ok")
}

function coerceConfidence(v: unknown): Confidence | undefined {
  return v === "high" || v === "medium" || v === "low" ? v : undefined;
}

function ledgerToBlock(lines: AssumptionLine[]): string {
  return lines
    .map((l) => {
      const val = l.annual
        ? `annual ${l.annual.low}-${l.annual.high} ${l.annual.currency} × ${l.years ?? "?"}y`
        : l.amount
          ? `${l.amount.low}-${l.amount.high} ${l.amount.currency}`
          : typeof l.rate === "number"
            ? `${(l.rate * 100).toFixed(0)}%`
            : "—";
      // For a carry line, show the INPUTS the amount was computed from so the
      // validator judges the inputs (fund size, tier), not the derived figure.
      const carryNote = l.carry
        ? ` · carry[fund=${l.carry.fundSizeUsd} · tier=${l.carry.seniorityTier ?? "?"} · pct≈${(
            l.carry.personalCarryPct.base * 100
          ).toFixed(1)}% · mult≈${l.carry.grossMultiple?.base ?? "default"}× (code-computed)]`
        : "";
      return `${l.id} [${l.category}] ${l.label} = ${val}${carryNote} · basis=${l.basis} · ref=${l.sourceRef || "none"} · confidence=${l.confidence}`;
    })
    .join("\n");
}

export async function validateWealthEstimate(
  lines: AssumptionLine[],
  sourceText: string,
): Promise<WealthValidation | undefined> {
  if (lines.length === 0) return undefined;

  const input = [
    "SOURCE MATERIAL:",
    sourceText.trim() || "(none provided)",
    "",
    "LEDGER:",
    ledgerToBlock(lines),
  ].join("\n");

  let text: string;
  try {
    const response = await openai.responses.create({
      model: VALIDATOR_MODEL,
      instructions: VALIDATE_INSTRUCTIONS,
      input,
    });
    text = response.output_text ?? "";
  } catch {
    return undefined;
  }

  let raw: {
    lineVerdicts?: unknown;
    overConfident?: unknown;
    rangeAdvice?: unknown;
    overallConfidence?: unknown;
  };
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    raw = JSON.parse(start >= 0 && end >= 0 ? text.slice(start, end + 1) : text);
  } catch {
    return undefined;
  }

  const lineVerdicts = Array.isArray(raw.lineVerdicts)
    ? (raw.lineVerdicts as Record<string, unknown>[])
        .map((v) => ({
          id: typeof v.id === "string" ? v.id : "",
          verdict: coerceVerdict(v.verdict),
          note: typeof v.note === "string" ? v.note : "",
          suggestedConfidence: coerceConfidence(v.suggestedConfidence),
        }))
        .filter((v) => v.id.length > 0)
    : [];

  const flaggedCount = lineVerdicts.filter(
    (v) => v.verdict === "ungrounded" || v.verdict === "implausible",
  ).length;

  return {
    lineVerdicts,
    overConfident: raw.overConfident === true,
    rangeAdvice: raw.rangeAdvice === "widen" ? "widen" : "ok",
    overallConfidence: coerceConfidence(raw.overallConfidence) ?? "medium",
    flaggedCount,
    validatorModel: VALIDATOR_MODEL,
    validatedAt: new Date().toISOString(),
  };
}
