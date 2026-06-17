import OpenAI from "openai";

// Lazy-initialise the OpenAI client so importing this module does NOT
// require the env vars to be present at startup. Routes that don't use AI
// (e.g. /api/healthz, /api/prospects) must still work in environments where
// the OpenAI integration hasn't been provisioned. Routes that DO use AI
// will get a clear error the moment they try to call the client.
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;

  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }

  _client = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  return _client;
}

// Proxy: forwards every property access to a real OpenAI instance, but the
// real instance is only created the first time you actually use one.
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
