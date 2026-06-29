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
export { prepResponseSpec, parsePrepResponse, type ParsedPrep } from "./write/prepSchema";
export {
  PE_COMP_SOURCES,
  PE_CASH_COMP_USD,
  PE_CARRY_PERSONAL_PCT_PARTNER,
  peCompReference,
  type PeCompSource,
} from "./reference/peComp";

// Robust retrieval — DataForSEO + Jina
export { retrieve, retrievalConfigured, type RetrieveOptions } from "./sources/retrieve";
export { dataForSeoConfigured, dataForSeoSearch } from "./sources/dataforseo";
export { jinaConfigured, jinaRead, jinaSearch } from "./sources/jina";

// Deep, multi-angle research for UHNW prospects
export {
  deepResearch,
  corpusToPromptBlock,
  DEFAULT_ANGLES,
  QUICK_ANGLES,
  type DeepResearchOptions,
  type DeepResearchProgress,
  type ResearchDepth,
} from "./research/deepResearch";
export { DEEP_DIVE_SOURCES, domainsForAngle, type DeepDiveSource } from "./sources/deepDiveSources";

// Source-of-Wealth evidence reference (grounds the prep generator)
export {
  SOW_EVIDENCE_REFERENCE,
  sowEvidencePromptBlock,
  type SowCategoryReference,
} from "./reference/sowEvidence";

// Net-worth / Source-of-Wealth estimation engine
export { estimateWealth, type EstimateWealthArgs } from "./estimate/wealthEstimate";
export { computeEstimate, rollUpConfidence } from "./estimate/compute";
export { assumptionsToQuestions } from "./estimate/assumptionQuestions";
export { validateWealthEstimate } from "./verify/wealthEstimate";
