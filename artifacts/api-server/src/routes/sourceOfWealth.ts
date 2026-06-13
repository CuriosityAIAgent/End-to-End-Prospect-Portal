import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  DraftSourceOfWealthBody,
  DraftSourceOfWealthResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// The six narrative sections the model must return, keyed exactly as the
// frontend stores them (sow.<key>). Order matches the document's display order.
const STATEMENT_SECTIONS = [
  "overview",
  "employment",
  "compensation",
  "assetGrowth",
  "wealthEvents",
  "plausibility",
] as const;

// System prompt: synthesise a regulator-facing Source of Wealth statement from
// the meeting note + optional coverage + optional pre-meeting briefing. The
// hard rules (no fabrication, plausibility framed as plausibility, empty where
// no basis) are what make the output safe to drop into a KYC file.
const DRAFT_INSTRUCTIONS = [
  "You are an expert private banking analyst drafting the Source of Wealth (SoW) statement for a client's onboarding file. This is a regulator-facing KYC document.",
  "You will be given the banker's meeting note, optionally the banker's confirmed discussion topics, and optionally a pre-meeting research briefing. From these inputs ONLY, draft a clear, professional Source of Wealth statement.",
  "",
  "The statement must explain HOW the client built their wealth (its origin) and set out a plausible picture of WHEN and HOW it accumulated across employment, compensation, asset growth and discrete wealth events, together with an assessment of plausibility and corroboration.",
  "",
  "Return a JSON object with exactly these string fields:",
  '- "overview": The core narrative of how the client built their overall wealth — the origin story and primary source(s).',
  '- "employment": Wealth from salary and employment income over the client\'s career. Empty string if the inputs give no basis.',
  '- "compensation": Wealth from variable pay — bonuses, stock / options, RSUs, carried interest, profit share. Empty string if no basis.',
  '- "assetGrowth": Wealth from the growth of assets — investments, portfolio gains, property and business-value appreciation. Empty string if no basis.',
  '- "wealthEvents": Wealth from discrete events — business sale, inheritance, gifts, legal settlements, windfalls. Empty string if no basis.',
  '- "plausibility": Whether the overall picture is internally consistent and proportionate to the client\'s profile, and what documentary evidence would corroborate it.',
  "",
  "CRITICAL RULES:",
  "- Never fabricate facts, figures, dates, employers, or amounts. Use ONLY what the inputs support.",
  "- Where the inputs give no basis for a section, return an empty string for that section. Do not pad with generic boilerplate.",
  '- Distinguish established fact from inference. Frame any inference as plausibility (e.g. "This is consistent with…", "would plausibly account for…"), never as confirmed fact.',
  "- Write in measured, professional language suitable for compliance and regulatory review.",
  '- Return ONLY the JSON object of the form {"overview":"","employment":"","compensation":"","assetGrowth":"","wealthEvents":"","plausibility":""}. No preamble, no explanation, no markdown.',
].join("\n");

function coverageLines(
  coverage: { label: string; value: string; detail?: string }[],
): string {
  return coverage
    .map((c) =>
      c.detail && c.detail.trim().length > 0
        ? `- ${c.label}: ${c.value} — ${c.detail.trim()}`
        : `- ${c.label}: ${c.value}`,
    )
    .join("\n");
}

router.post("/source-of-wealth/draft", async (req, res): Promise<void> => {
  const parsed = DraftSourceOfWealthBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid source-of-wealth draft body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { clientName, note, coverage, briefing } = parsed.data;
  const hasNote = typeof note === "string" && note.trim().length > 0;
  const hasCoverage = Array.isArray(coverage) && coverage.length > 0;
  const hasBriefing =
    !!briefing &&
    (!!briefing.summary?.trim() ||
      (briefing.talkingPoints?.length ?? 0) > 0 ||
      (briefing.referralRoutes?.length ?? 0) > 0 ||
      !!briefing.recommendedApproach?.trim());

  if (!hasNote && !hasBriefing) {
    res.status(400).json({
      error: "Provide a meeting note or a pre-meeting briefing to draft from.",
    });
    return;
  }

  const briefingBlock: string[] = [];
  if (hasBriefing && briefing) {
    briefingBlock.push("", "PRE-MEETING RESEARCH BRIEFING:");
    if (briefing.summary?.trim()) briefingBlock.push(`Summary: ${briefing.summary.trim()}`);
    if (briefing.talkingPoints?.length) {
      briefingBlock.push("Talking points:", ...briefing.talkingPoints.map((p) => `- ${p}`));
    }
    if (briefing.referralRoutes?.length) {
      briefingBlock.push("Referral routes:", ...briefing.referralRoutes.map((r) => `- ${r}`));
    }
    if (briefing.recommendedApproach?.trim()) {
      briefingBlock.push(`Recommended approach: ${briefing.recommendedApproach.trim()}`);
    }
  }

  const input = [
    `Client: ${clientName}`,
    "",
    "MEETING FILE NOTE:",
    hasNote ? note!.trim() : "(no meeting note provided)",
    ...(hasCoverage ? ["", "CONFIRMED DISCUSSION TOPICS:", coverageLines(coverage!)] : []),
    ...briefingBlock,
  ].join("\n");

  try {
    const response = await openai.responses.create({
      model: "gpt-5.4",
      instructions: DRAFT_INSTRUCTIONS,
      input,
    });

    const text = response.output_text ?? "";

    let statement: Record<string, string>;
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const slice = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
      const raw = JSON.parse(slice) as Record<string, unknown>;
      statement = Object.fromEntries(
        STATEMENT_SECTIONS.map((key) => {
          const v = raw[key];
          return [key, typeof v === "string" ? v.trim() : ""];
        }),
      ) as Record<string, string>;
    } catch {
      req.log.error("Failed to parse source-of-wealth JSON from model");
      res.status(502).json({ error: "The statement could not be drafted. Please try again." });
      return;
    }

    // An all-empty statement is valid information ("the inputs gave no basis"),
    // so return 200 and let the UI guide the banker. 502 is reserved for genuine
    // model / parse failures only.
    res.json(DraftSourceOfWealthResponse.parse({ statement }));
  } catch (err) {
    req.log.error({ err }, "Source-of-wealth draft failed");
    res.status(502).json({ error: "The statement could not be drafted. Please try again." });
  }
});

export default router;
