// @workspace/research-pipeline — server entry.
// (Frontend code should import types only from "@workspace/research-pipeline/types".)

export * from "./types";

// Verification — "OpenAI verifies"
export { verifySourceOfWealth } from "./verify/sourceOfWealth";

// Writing — "Claude writes"
export {
  anthropicConfigured,
  writeWithClaude,
  claudeWriterModel,
} from "./write/anthropic";

// Robust retrieval — DataForSEO + Jina
export { retrieve, retrievalConfigured, type RetrieveOptions } from "./sources/retrieve";
export { dataForSeoConfigured, dataForSeoSearch } from "./sources/dataforseo";
export { jinaConfigured, jinaRead, jinaSearch } from "./sources/jina";
