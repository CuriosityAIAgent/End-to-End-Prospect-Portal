// ============================================================================
// Claude writer
//
// The "Claude writes, OpenAI verifies" split. This module is the writer half.
// It is env-gated: with no ANTHROPIC_API_KEY the caller falls back to the
// existing OpenAI writer, so the app keeps working until the key is provisioned.
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

/** True when an Anthropic key is provisioned and the Claude writer can be used. */
export function anthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const WRITER_MODEL = process.env.SOW_WRITER_MODEL ?? "claude-sonnet-4-6";

/**
 * Generic single-turn completion: a system prompt + a user input, returns the
 * concatenated text. Mirrors the shape the OpenAI Responses calls use, so the
 * route can swap writers with no other change.
 */
export async function writeWithClaude(args: {
  instructions: string;
  input: string;
  maxTokens?: number;
}): Promise<string> {
  const message = await getClient().messages.create({
    model: WRITER_MODEL,
    max_tokens: args.maxTokens ?? 2000,
    system: args.instructions,
    messages: [{ role: "user", content: args.input }],
  });

  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/** The model id the Claude writer uses (for provenance / logging). */
export function claudeWriterModel(): string {
  return WRITER_MODEL;
}
