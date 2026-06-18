import OpenAI from "openai";

// Standard OpenAI configuration. Set OPENAI_API_KEY; OPENAI_BASE_URL is
// optional (e.g. a gateway/proxy). The legacy AI_INTEGRATIONS_OPENAI_* names
// are still honoured for back-compat.
const apiKey =
  process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const baseURL =
  process.env.OPENAI_BASE_URL ?? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY must be set to use the OpenAI integration.");
}

export const openai = new OpenAI({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});
