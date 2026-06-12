import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { RewriteFileNoteBody, RewriteFileNoteResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// System prompt for the first pass: turn the banker's raw, free-form meeting
// note into a structured professional file note. Ported from the prototype.
const REWRITE_INSTRUCTIONS = [
  "You are an expert private banking file note writer. Your job is to rewrite raw file notes into polished, professional private banking documentation that follows industry standards.",
  "",
  "Your rewritten notes should:",
  "- Use clear, concise business language appropriate for private banking",
  "- Organize information logically and hierarchically",
  "- Follow this structure:",
  "  * Client / Contact: [name and key context]",
  "  * Meeting Type & Date: [type and date]",
  "  * Key Discussion Points: [main topics discussed, organized by theme]",
  "  * Client Profile & Situation: [relevant background, financial position, family situation]",
  "  * Client Objectives & Priorities: [investment goals, risk tolerance, key concerns]",
  "  * Current Relationships: [existing advisers, banking relationships, any competitive threats]",
  "  * Next Steps & Agreed Actions: [specific commitments, follow-ups, responsible parties, timelines]",
  "  * Summary / Key Themes: [brief assessment of relationship trajectory, opportunities, risk factors]",
  "- Maintain all factual information from the original note",
  "- Enhance clarity without adding new information",
  "- Use professional tone suitable for regulatory review",
  "- Be concise but complete",
  "- Format with clear headings and bullet points where appropriate",
  "",
  "Return only the reformatted file note. Do not include any preamble, explanation, or markdown formatting outside the note itself.",
].join("\n");

// System prompt for the second pass: weave the banker's confirmed discussion
// topics into an existing draft. Ported from the prototype.
const ENHANCE_INSTRUCTIONS = [
  "You are an expert private banking file note writer. You will be given a draft professional file note and a set of topic coverage confirmations selected by the banker.",
  "Your task is to enhance the draft note by incorporating the confirmed discussion areas naturally and professionally.",
  "Do not fabricate specific details or figures — use the topic selections to confirm, expand, or add brief professional commentary where appropriate.",
  "Maintain the existing structure and all factual content.",
  "Return only the enhanced note with no preamble or explanation.",
].join("\n");

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
    const detailLines = coverage
      .map((c) => (c.detail && c.detail.trim().length > 0 ? `- ${c.label}: ${c.value} — ${c.detail.trim()}` : `- ${c.label}: ${c.value}`))
      .join("\n");
    input = [
      "Please enhance this draft private banking file note using the discussion coverage details below.",
      "",
      "DRAFT NOTE:",
      note,
      "",
      "DISCUSSION COVERAGE CONFIRMED BY BANKER:",
      detailLines,
      "",
      'Incorporate confirmed topics into the relevant sections of the note. Where a topic was "Not discussed" or "None", do not mention it. Return only the enhanced file note.',
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
      model: "gpt-5.4",
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
