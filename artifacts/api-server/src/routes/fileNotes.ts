import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  RewriteFileNoteBody,
  RewriteFileNoteResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Shared professional file-note structure. Used by BOTH the rewrite (first pass)
// and enhance (second pass) so an enhanced note is just as polished as a
// freshly-rewritten one.
const NOTE_STRUCTURE = [
  "  * Client / Contact: [name and key context]",
  "  * Meeting Type & Date: [type and date]",
  "  * Key Discussion Points: [main topics discussed, organized by theme]",
  "  * Client Profile & Situation: [relevant background, financial position, family situation]",
  "  * Client Objectives & Priorities: [investment goals, risk tolerance, key concerns]",
  "  * Current Relationships: [existing advisers, banking relationships, any competitive threats]",
  "  * Next Steps & Agreed Actions: [specific commitments, follow-ups, responsible parties, timelines]",
  "  * Summary / Key Themes: [brief assessment of relationship trajectory, opportunities, risk factors]",
];

// System prompt for the first pass: turn the banker's raw, free-form meeting
// note into a structured professional file note.
const REWRITE_INSTRUCTIONS = [
  "You are an expert private banking file note writer. Your job is to rewrite raw file notes into polished, professional private banking documentation that follows industry standards.",
  "",
  "Your rewritten notes should:",
  "- Use clear, concise business language appropriate for private banking",
  "- Organize information logically and hierarchically",
  "- Follow this structure:",
  ...NOTE_STRUCTURE,
  "- Maintain all factual information from the original note",
  "- CRITICAL: carry across EVERY number, monetary amount, percentage, date, and specific asset value from the note VERBATIM (e.g. \"£17m property in Whiteleys, £5m mortgage\"). Never delete, round, generalise, or summarise a figure away — specific figures are the most important content in a private-banking note.",
  "- Enhance clarity without adding new information",
  "- Use professional tone suitable for regulatory review",
  "- Be concise but complete",
  "- Format with clear headings and bullet points where appropriate",
  "",
  "Return only the reformatted file note. Do not include any preamble, explanation, or markdown formatting outside the note itself.",
].join("\n");

// System prompt for the second pass: incorporate the banker's confirmed
// discussion topics into the note AND re-run the full professional formatting,
// so the result is a clean, regulator-ready note — not just a lightly-annotated
// draft.
const ENHANCE_INSTRUCTIONS = [
  "You are an expert private banking file note writer. You will be given a draft meeting file note and a set of discussion-topic confirmations the banker selected.",
  "Your task is to produce ONE polished, professional private banking file note that BOTH incorporates the banker's confirmed discussion topics AND is fully reformatted to professional standards — exactly as if it had been run through the professional rewriter.",
  "",
  "The final note must:",
  "- Weave the confirmed discussion topics naturally into the relevant sections",
  "- Use clear, concise business language appropriate for private banking",
  "- Organize information logically and hierarchically",
  "- Follow this structure:",
  ...NOTE_STRUCTURE,
  "- Maintain all factual information from the original draft note",
  "- CRITICAL: carry across EVERY number, monetary amount, percentage, date, and specific asset value VERBATIM. Never delete, round, generalise, or summarise a figure away.",
  "- Use professional tone suitable for regulatory review, with clear headings and bullet points where appropriate",
  "- Be concise but complete",
  "",
  "Do not fabricate specific details, figures, or facts that are not present in the draft or the confirmed topics. Use the topic selections to confirm, organise, or add brief professional commentary only.",
  'Where a topic reads "Not discussed" or "None", do not mention it.',
  "Return only the final professional file note. Do not include any preamble, explanation, or markdown formatting outside the note itself.",
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

router.post("/file-notes/rewrite", async (req, res): Promise<void> => {
  const parsed = RewriteFileNoteBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid file-note rewrite body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { contact, meetingType, date, note, coverage } = parsed.data;
  const isEnhance = Array.isArray(coverage) && coverage.length > 0;

  const instructions = isEnhance ? ENHANCE_INSTRUCTIONS : REWRITE_INSTRUCTIONS;

  let input: string;
  if (isEnhance) {
    input = [
      "Produce a single polished, professional private banking file note that incorporates the discussion coverage below and applies the full professional formatting.",
      "",
      `Meeting Type: ${meetingType || "Not specified"}`,
      `Contact: ${contact}`,
      `Date: ${date || "Not specified"}`,
      "",
      "DRAFT NOTE:",
      note,
      "",
      "DISCUSSION COVERAGE CONFIRMED BY BANKER:",
      coverageLines(coverage),
      "",
      'Incorporate the confirmed topics into the relevant sections and reformat the whole note to professional standards. Where a topic was "Not discussed" or "None", do not mention it. Return only the final professional file note.',
    ].join("\n");
  } else {
    input = [
      "Please rewrite this raw file note into a professional private banking file note format:",
      "",
      `Meeting Type: ${meetingType || "Not specified"}`,
      `Contact: ${contact}`,
      `Date: ${date || "Not specified"}`,
      "",
      "Raw Note:",
      note,
    ].join("\n");
  }

  try {
    const response = await openai.responses.create({
      model: process.env.FILE_NOTE_MODEL ?? "gpt-4o",
      instructions,
      input,
    });

    const text = (response.output_text ?? "").trim();

    if (text.length === 0) {
      req.log.error("Model returned an empty file note");
      res.status(502).json({ error: "The note could not be rewritten. Please try again." });
      return;
    }

    res.json(RewriteFileNoteResponse.parse({ note: text }));
  } catch (err) {
    req.log.error({ err }, "File-note rewrite failed");
    res.status(502).json({ error: "The note could not be rewritten. Please try again." });
  }
});

export default router;
