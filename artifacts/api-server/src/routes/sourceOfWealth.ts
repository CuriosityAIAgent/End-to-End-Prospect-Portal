import { Router, type IRouter } from "express";
import {
  anthropicConfigured,
  draft,
  verifySourceOfWealth,
  type SourceOfWealthVerification,
} from "@workspace/research-pipeline";
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
// the meeting note + optional coverage + optional pre-meeting briefing.
//
// Tone (per Rupert): WHEN a meeting note is present the statement is written
// AFTER the banker has met the client and confirmed the picture, so it reads
// DEFINITIVELY — what the client confirmed is stated as established fact, not
// hedged. Briefing-only drafts (no meeting yet) stay provisional and attributed.
// The safety rails always hold: never fabricate, empty where there is no basis,
// and genuine inferences are still framed as inferences (the verifier relies on
// that framing to tell inference from fabrication).
function draftInstructions(hasConfirmed: boolean): string {
  const toneIntro = hasConfirmed
    ? "This statement is written AFTER the banker has met the client and confirmed the picture — the conversations have already happened. Treat the banker's meeting note and confirmed discussion topics as information the client has CONFIRMED: state it definitively, in plain declarative language, not as speculation. A pre-meeting research briefing, where provided, is supporting context only — do not present unconfirmed research as something the client stated."
    : "No meeting has taken place yet: you are drafting a PROVISIONAL picture from pre-meeting research only. Write it as indicative and to-be-confirmed with the client — attribute research (e.g. \"public reporting indicates…\") and state nothing as client-confirmed fact.";
  const toneRules = hasConfirmed
    ? [
        "- State what the client has confirmed — the meeting note and the banker's confirmed discussion topics — declaratively and confidently. These are confirmed; do not couch them in tentative language.",
        '- Pre-meeting briefing material that the meeting note does not corroborate is unverified desk research: attribute it (e.g. "public reporting indicates…") rather than presenting it as client-confirmed fact.',
      ]
    : [
        '- Nothing here is client-confirmed. Attribute every claim to its research source (e.g. "public reporting indicates…") and write the picture as provisional, to be confirmed with the client.',
      ];
  return [
    "You are an expert private banking analyst drafting the Source of Wealth (SoW) statement for a client's onboarding file. This is a regulator-facing KYC document.",
    toneIntro,
    "From these inputs ONLY, draft a clear, professional Source of Wealth statement explaining HOW the client built their wealth and how it accumulated across employment, compensation, asset growth and discrete wealth events.",
    "",
    "Return a JSON object with exactly these string fields:",
    '- "overview": The core narrative of how the client built their overall wealth — the origin story and primary source(s).',
    '- "employment": Wealth from salary and employment income over the client\'s career. Empty string if the inputs give no basis.',
    '- "compensation": Wealth from variable pay — bonuses, stock / options, RSUs, carried interest, profit share. Empty string if no basis.',
    '- "assetGrowth": Wealth from the growth of assets — investments, portfolio gains, property and business-value appreciation. Empty string if no basis.',
    '- "wealthEvents": Wealth from discrete events — business sale, inheritance, gifts, legal settlements, windfalls. Empty string if no basis.',
    '- "plausibility": Confirm that the overall picture is internally consistent and proportionate to the client\'s profile, and identify the documentary evidence that would corroborate it. Do not claim documents you have not been shown.',
    "",
    "CRITICAL RULES:",
    "- Never fabricate facts, figures, dates, employers, or amounts. Use ONLY what the inputs support.",
    "- Where the inputs give no basis for a section, return an empty string for that section. Do not pad with generic boilerplate.",
    ...toneRules,
    '- Any other claim that is not directly stated in the inputs but is a reasonable reading you are drawing MUST still be framed explicitly as an inference (e.g. "this is consistent with…", "would plausibly account for…"), never asserted as confirmed fact. Hedge the inference itself — not the confirmed facts around it.',
    "- Write in measured, professional language suitable for compliance and regulatory review.",
    '- Return ONLY the JSON object of the form {"overview":"","employment":"","compensation":"","assetGrowth":"","wealthEvents":"","plausibility":""}. No preamble, no explanation, no markdown.',
  ].join("\n");
}

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
    // Writer: Claude when configured ("Claude writes, OpenAI verifies"),
    // otherwise OpenAI (model honours SOW_WRITER_MODEL_OPENAI). Same engine the
    // briefing / prep routes use. Override the choice with SOW_WRITER_PROVIDER.
    const useClaude =
      (process.env.SOW_WRITER_PROVIDER ??
        (anthropicConfigured() ? "anthropic" : "openai")) === "anthropic";
    const { text } = await draft({
      instructions: draftInstructions(hasNote || hasCoverage),
      input,
      preferClaude: useClaude,
    });

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

    // Independent cross-model verification of the draft against its source
    // material (the writer's exact input). Non-fatal: a verifier failure returns
    // undefined and the draft still reaches the banker, just without badges.
    let verification: SourceOfWealthVerification | undefined;
    try {
      verification = await verifySourceOfWealth({ statement, sourceText: input });
    } catch (err) {
      req.log.warn({ err }, "Source-of-wealth verification failed (non-fatal)");
    }

    // An all-empty statement is valid information ("the inputs gave no basis"),
    // so return 200 and let the UI guide the banker. 502 is reserved for genuine
    // model / parse failures only. `verification` is appended alongside the
    // schema-validated statement (additive; to be folded into the OpenAPI
    // contract once codegen is run on a build host).
    res.json({
      ...DraftSourceOfWealthResponse.parse({ statement }),
      ...(verification ? { verification } : {}),
    });
  } catch (err) {
    req.log.error({ err }, "Source-of-wealth draft failed");
    res.status(502).json({ error: "The statement could not be drafted. Please try again." });
  }
});

export default router;
