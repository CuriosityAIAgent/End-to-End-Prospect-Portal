import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Lazy-initialise the Anthropic (Claude) client. Importing this module does
// NOT require ANTHROPIC_API_KEY to be set — routes that don't use AI still
// load cleanly in environments where the integration hasn't been provisioned.
// The first property access (e.g. claude.messages.create(...)) checks the env
// var and throws with a clear message if it's missing.
let _claude: Anthropic | null = null;
function getClaude(): Anthropic {
  if (_claude) return _claude;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY must be set. Add it to the Vercel project's environment variables.",
    );
  }
  _claude = new Anthropic();
  return _claude;
}

export const claude = new Proxy({} as Anthropic, {
  get(_target, prop, receiver) {
    const client = getClaude();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// Separate lazy OpenAI client — used ONLY by the audio/transcription path,
// which has no Claude equivalent (Anthropic has no audio model). Routes that
// don't transcribe never trip the env-var check.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set for transcription (Whisper). " +
        "If you don't need voice notes, this can stay unset.",
    );
  }
  _openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  return _openai;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const client = getOpenAI();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// Default Claude model — Opus 4.8 is the most capable. Override per-call if
// needed (e.g. switch to claude-sonnet-4-6 for cost-sensitive routes).
export const DEFAULT_CLAUDE_MODEL = "claude-opus-4-8";
