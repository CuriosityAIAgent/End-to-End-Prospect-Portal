import OpenAI from "openai";

// Lazy client: constructed on first use, NOT at import. This lets the server
// boot without an OpenAI key (the app/static site deploys; only AI endpoints
// fail per-request until the key is set) instead of crashing at startup.
//
// Set OPENAI_API_KEY; OPENAI_BASE_URL is optional (e.g. a gateway/proxy). The
// legacy AI_INTEGRATIONS_OPENAI_* names are still honoured for back-compat.
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;
  const apiKey =
    process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL =
    process.env.OPENAI_BASE_URL ?? process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be set to use the OpenAI integration.");
  }
  _client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  return _client;
}

// Proxy so existing `openai.responses.create(...)` call sites keep working while
// construction (and the missing-key error) is deferred to first actual use.
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
