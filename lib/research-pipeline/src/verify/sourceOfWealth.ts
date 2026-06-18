// ============================================================================
// Source-of-Wealth verifier
//
// An independent compliance verifier that checks a drafted SoW statement, claim
// by claim, against the source material it was written from. Cross-model on
// purpose: when Claude writes the statement, OpenAI verifies it here — an
// independent model is far more likely to catch the writer's own fabrications
// than asking the writer to grade itself.
//
// Failure is non-fatal: if the verifier errors or returns garbage we return
// `undefined` so the draft still reaches the banker (just without the badges).
// ============================================================================

import { openai } from "@workspace/integrations-openai-ai-server";
import type {
  ClaimCheck,
  ClaimStatus,
  Confidence,
  SectionVerdict,
  SectionVerification,
  SourceOfWealthVerification,
} from "../types";

const VERIFIER_MODEL = process.env.SOW_VERIFIER_MODEL ?? "gpt-5.4";

// The six statement keys, in document order. Kept local so the verifier has no
// dependency on the frontend catalog.
const SECTION_KEYS = [
  "overview",
  "employment",
  "compensation",
  "assetGrowth",
  "wealthEvents",
  "plausibility",
] as const;

const VERIFY_INSTRUCTIONS = [
  "You are an independent compliance verifier at a private bank. Another analyst has drafted a regulator-facing Source of Wealth (SoW) statement. You are given the SOURCE MATERIAL the analyst worked from and their DRAFTED STATEMENT.",
  "Your only job is to check, claim by claim, whether the statement is actually supported by the SOURCE MATERIAL. You are the safety net against fabrication — be sceptical, not generous.",
  "",
  "For every NON-EMPTY section, break it into its distinct factual claims (names, employers, figures, dates, amounts, events, relationships) and classify each:",
  '- "supported": the claim is directly backed by something in the SOURCE MATERIAL.',
  '- "inference": the claim is not stated outright but is a reasonable reading the draft frames as plausibility/likelihood (e.g. "this is consistent with…"). Acceptable, but mark it.',
  '- "unsupported": the claim is NOT backed by the SOURCE MATERIAL and is not framed as an inference. This is a possible fabrication — flag it.',
  "",
  "For each claim also give a short `evidence` note: what in the source backs it, or why it could not be confirmed.",
  "Do NOT invent claims that are not in the draft. Skip sections that are empty.",
  "",
  'Return ONLY a JSON object of the form {"sections":[{"section":"overview","claims":[{"claim":"...","status":"supported|inference|unsupported","evidence":"..."}]}]}. No markdown, no prose around it.',
].join("\n");

function coerceStatus(v: unknown): ClaimStatus {
  return v === "supported" || v === "inference" || v === "unsupported"
    ? v
    : "unsupported"; // unknown ⇒ treat as unsupported (fail safe, not fail open)
}

function sectionVerdict(claims: ClaimCheck[]): SectionVerdict {
  if (claims.length === 0) return "empty";
  const supported = claims.filter(
    (c) => c.status === "supported" || c.status === "inference",
  ).length;
  const unsupported = claims.filter((c) => c.status === "unsupported").length;
  if (unsupported === 0) return "supported";
  if (supported === 0) return "unsupported";
  return "partially_supported";
}

function sectionConfidence(claims: ClaimCheck[]): Confidence {
  if (claims.length === 0) return "high";
  const unsupported = claims.filter((c) => c.status === "unsupported").length;
  const inferences = claims.filter((c) => c.status === "inference").length;
  if (unsupported >= 2) return "low";
  if (unsupported === 1) return "medium";
  if (inferences > claims.length / 2) return "medium";
  return "high";
}

function rollUp(confidences: Confidence[], flaggedCount: number): Confidence {
  if (flaggedCount >= 2) return "low";
  if (flaggedCount === 1 || confidences.includes("low")) return "medium";
  if (confidences.includes("medium")) return "medium";
  return "high";
}

export async function verifySourceOfWealth(args: {
  /** The six drafted sections, keyed bare (overview, employment, …). */
  statement: Record<string, string>;
  /** The exact source text the writer was given (note + coverage + briefing). */
  sourceText: string;
}): Promise<SourceOfWealthVerification | undefined> {
  const { statement, sourceText } = args;

  // Nothing drafted ⇒ nothing to verify.
  const hasContent = SECTION_KEYS.some(
    (k) => (statement[k] ?? "").trim().length > 0,
  );
  if (!hasContent) return undefined;

  const draftBlock = SECTION_KEYS.filter(
    (k) => (statement[k] ?? "").trim().length > 0,
  )
    .map((k) => `### ${k}\n${(statement[k] ?? "").trim()}`)
    .join("\n\n");

  const input = [
    "SOURCE MATERIAL:",
    sourceText.trim() || "(none provided)",
    "",
    "DRAFTED STATEMENT:",
    draftBlock,
  ].join("\n");

  let text: string;
  try {
    const response = await openai.responses.create({
      model: VERIFIER_MODEL,
      instructions: VERIFY_INSTRUCTIONS,
      input,
    });
    text = response.output_text ?? "";
  } catch {
    return undefined;
  }

  let parsedSections: { section?: unknown; claims?: unknown }[];
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const slice = start >= 0 && end >= 0 ? text.slice(start, end + 1) : text;
    const raw = JSON.parse(slice) as { sections?: unknown };
    parsedSections = Array.isArray(raw.sections)
      ? (raw.sections as { section?: unknown; claims?: unknown }[])
      : [];
  } catch {
    return undefined;
  }

  // Index the model's claim checks by section key.
  const byKey = new Map<string, ClaimCheck[]>();
  for (const s of parsedSections) {
    const key = typeof s.section === "string" ? s.section.replace(/^sow\./, "") : "";
    if (!SECTION_KEYS.includes(key as (typeof SECTION_KEYS)[number])) continue;
    const claims: ClaimCheck[] = Array.isArray(s.claims)
      ? (s.claims as Record<string, unknown>[])
          .map((c) => ({
            claim: typeof c.claim === "string" ? c.claim : "",
            status: coerceStatus(c.status),
            evidence: typeof c.evidence === "string" ? c.evidence : "",
          }))
          .filter((c) => c.claim.trim().length > 0)
      : [];
    byKey.set(key, claims);
  }

  // Build a verification entry for every drafted (non-empty) section.
  const sections: SectionVerification[] = SECTION_KEYS.filter(
    (k) => (statement[k] ?? "").trim().length > 0,
  ).map((k) => {
    const claims = byKey.get(k) ?? [];
    return {
      section: k,
      verdict: sectionVerdict(claims),
      confidence: sectionConfidence(claims),
      claims,
    };
  });

  const flaggedCount = sections.reduce(
    (n, s) => n + s.claims.filter((c) => c.status === "unsupported").length,
    0,
  );

  return {
    sections,
    overallConfidence: rollUp(
      sections.map((s) => s.confidence),
      flaggedCount,
    ),
    flaggedCount,
    verifierModel: VERIFIER_MODEL,
    verifiedAt: new Date().toISOString(),
  };
}
