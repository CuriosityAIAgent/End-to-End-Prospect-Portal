// @workspace/research-pipeline — server entry.
// (Frontend code should import types only from "@workspace/research-pipeline/types".)

export * from "./types";

// Verification — "OpenAI verifies"
export { verifySourceOfWealth } from "./verify/sourceOfWealth";
export { verifySections, type SectionInput } from "./verify/sections";

// Writing — "Claude writes"
export {
  anthropicConfigured,
  writeWithClaude,
  claudeWriterModel,
} from "./write/anthropic";
export { draft, type DraftOptions, type DraftResult } from "./write/draft";

// Robust retrieval — DataForSEO + Jina
export { retrieve, retrievalConfigured, type RetrieveOptions } from "./sources/retrieve";
export { dataForSeoConfigured, dataForSeoSearch } from "./sources/dataforseo";
export { jinaConfigured, jinaRead, jinaSearch } from "./sources/jina";

// Deep, multi-angle research for UHNW prospects
export {
  deepResearch,
  corpusToPromptBlock,
  DEFAULT_ANGLES,
  type DeepResearchOptions,
} from "./research/deepResearch";
export { DEEP_DIVE_SOURCES, domainsForAngle, type DeepDiveSource } from "./sources/deepDiveSources";

// Source-of-Wealth evidence reference (grounds the prep generator)
export {
  SOW_EVIDENCE_REFERENCE,
  sowEvidencePromptBlock,
  type SowCategoryReference,
} from "./reference/sowEvidence";
