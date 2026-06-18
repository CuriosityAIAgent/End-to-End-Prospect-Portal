// ============================================================================
// Unified writer
//
// One entry point the routes call to draft text. Picks the writer per the
// "Claude writes, OpenAI verifies" design:
//   • preferClaude && ANTHROPIC_API_KEY  → Claude (grounded in supplied corpus)
//   • otherwise                          → OpenAI Responses, optionally with the
//                                           web_search tool, returning citations.
// ============================================================================

import { openai } from "@workspace/integrations-openai-ai-server";
import { anthropicConfigured, writeWithClaude } from "./anthropic";

// Only used as the fallback writer when Claude isn't configured. Override with
// SOW_WRITER_MODEL_OPENAI. (The primary writer is Claude — SOW_WRITER_MODEL.)
const OPENAI_WRITER_MODEL = process.env.SOW_WRITER_MODEL_OPENAI ?? "gpt-4o";

export interface DraftOptions {
  instructions: string;
  input: string;
  /** Use Claude when configured (you've supplied grounding corpus yourself). */
  preferClaude?: boolean;
  /** Let the OpenAI writer use its web_search tool (when not grounding via corpus). */
  allowWebSearch?: boolean;
  maxTokens?: number;
}

export interface DraftResult {
  text: string;
  /** url_citation sources collected from an OpenAI web_search pass (if any). */
  webSources: { title: string; url: string }[];
  writerModel: string;
}

export async function draft(options: DraftOptions): Promise<DraftResult> {
  if (options.preferClaude && anthropicConfigured()) {
    const text = await writeWithClaude({
      instructions: options.instructions,
      input: options.input,
      maxTokens: options.maxTokens,
    });
    return {
      text,
      webSources: [],
      writerModel: process.env.SOW_WRITER_MODEL ?? "claude-sonnet-4-6",
    };
  }

  const response = await openai.responses.create({
    model: OPENAI_WRITER_MODEL,
    instructions: options.instructions,
    input: options.input,
    ...(options.allowWebSearch ? { tools: [{ type: "web_search" as const }] } : {}),
  });

  const text = response.output_text ?? "";

  const webSources: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const item of response.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type !== "output_text") continue;
      for (const ann of part.annotations ?? []) {
        if (ann.type === "url_citation" && ann.url && !seen.has(ann.url)) {
          seen.add(ann.url);
          webSources.push({ title: ann.title || ann.url, url: ann.url });
        }
      }
    }
  }

  return { text, webSources, writerModel: OPENAI_WRITER_MODEL };
}
