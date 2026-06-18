// ============================================================================
// Generic section verifier — the shared engine behind SoW / briefing / prep
//
// Given a set of drafted sections and the SOURCE MATERIAL they were written
// from, an independent model checks each claim (supported / inference /
// unsupported) and we roll the results up deterministically in code. Failure is
// non-fatal: returns undefined so the draft still reaches the banker.
// ============================================================================

import { openai } from "@workspace/integrations-openai-ai-server";
import type {
  ClaimCheck,
  ClaimStatus,
  Confidence,
  SectionVerdict,
  SectionVerification,
  Verification,
} from "../types";

const VERIFIER_MODEL = process.env.SOW_VERIFIER_MODEL ?? "gpt-5.4";

const VERIFY_INSTRUCTIONS = [
  "You are an independent compliance verifier at a private bank. Another analyst has drafted client-facing material. You are given the SOURCE MATERIAL they worked from and their DRAFT, split into sections.",
  "Your only job is to check, claim by claim, whether the draft is actually supported by the SOURCE MATERIAL. You are the safety net against fabrication — be sceptical, not generous.",
  "",
  "For every section, break it into its distinct factual claims (names, employers, figures, dates, amounts, events, relationships, trusts/foundations) and classify each:",
  '- "supported": directly backed by something in the SOURCE MATERIAL.',
  '- "inference": not stated outright but a reasonable reading the draft frames as plausibility/likelihood. Acceptable, but mark it.',
  '- "unsupported": NOT backed by the SOURCE MATERIAL and not framed as an inference. A possible fabrication — flag it.',
  "",
  "For each claim give a short `evidence` note: what backs it, or why it could not be confirmed. Do NOT invent claims that are not in the draft.",
  "",
  'Return ONLY JSON: {"sections":[{"section":"<key>","claims":[{"claim":"...","status":"supported|inference|unsupported","evidence":"..."}]}]}. No markdown, no prose around it.',
].join("\n");

function coerceStatus(v: unknown): ClaimStatus {
  return v === "supported" || v === "inference" || v === "unsupported"
    ? v
    : "unsupported"; // unknown ⇒ unsupported (fail safe, not fail open)
}

function sectionVerdict(claims: ClaimCheck[]): SectionVerdict {
  if (claims.length === 0) return "empty";
  const ok = claims.filter((c) => c.status === "supported" || c.status === "inference").length;
  const bad = claims.filter((c) => c.status === "unsupported").length;
  if (bad === 0) return "supported";
  if (ok === 0) return "unsupported";
  return "partially_supported";
}

function sectionConfidence(claims: ClaimCheck[]): Confidence {
  if (claims.length === 0) return "high";
  const bad = claims.filter((c) => c.status === "unsupported").length;
  const inf = claims.filter((c) => c.status === "inference").length;
  if (bad >= 2) return "low";
  if (bad === 1) return "medium";
  if (inf > claims.length / 2) return "medium";
  return "high";
}

function rollUp(confidences: Confidence[], flaggedCount: number): Confidence {
  if (flaggedCount >= 2 || confidences.includes("low")) return flaggedCount >= 2 ? "low" : "medium";
  if (flaggedCount === 1 || confidences.includes("medium")) return "medium";
  return "high";
}

export interface SectionInput {
  /** Stable key shown back in the verdict (e.g. "overview", "summary"). */
  key: string;
  text: string;
}

export async function verifySections(
  sections: SectionInput[],
  sourceText: string,
): Promise<Verification | undefined> {
  const nonEmpty = sections.filter((s) => (s.text ?? "").trim().length > 0);
  if (nonEmpty.length === 0) return undefined;

  const draftBlock = nonEmpty
    .map((s) => `### ${s.key}\n${s.text.trim()}`)
    .join("\n\n");

  const input = [
    "SOURCE MATERIAL:",
    sourceText.trim() || "(none provided)",
    "",
    "DRAFT:",
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

  const byKey = new Map<string, ClaimCheck[]>();
  for (const s of parsedSections) {
    const key = typeof s.section === "string" ? s.section.replace(/^sow\./, "") : "";
    if (!key) continue;
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

  const sectionResults: SectionVerification[] = nonEmpty.map((s) => {
    const claims = byKey.get(s.key.replace(/^sow\./, "")) ?? [];
    return {
      section: s.key,
      verdict: sectionVerdict(claims),
      confidence: sectionConfidence(claims),
      claims,
    };
  });

  const flaggedCount = sectionResults.reduce(
    (n, s) => n + s.claims.filter((c) => c.status === "unsupported").length,
    0,
  );

  return {
    sections: sectionResults,
    overallConfidence: rollUp(sectionResults.map((s) => s.confidence), flaggedCount),
    flaggedCount,
    verifierModel: VERIFIER_MODEL,
    verifiedAt: new Date().toISOString(),
  };
}
