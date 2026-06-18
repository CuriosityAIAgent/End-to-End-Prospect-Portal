// ============================================================================
// research-pipeline — shared types
//
// Pure types only. NO runtime imports here, so the frontend can safely
// `import type { ... } from "@workspace/research-pipeline/types"` without
// pulling any server-only SDK into the browser bundle.
// ============================================================================

export type Confidence = "high" | "medium" | "low";

/** How well a single factual claim is backed by the source material. */
export type ClaimStatus =
  | "supported" // directly backed by the source material
  | "inference" // a reasonable, plausibility-framed inference (acceptable)
  | "unsupported"; // not backed by the source material — possible fabrication

/** Per-section roll-up, derived deterministically from the claim checks. */
export type SectionVerdict =
  | "supported" // every claim is supported or a framed inference
  | "partially_supported" // a mix of supported and unsupported claims
  | "unsupported" // claims present but none supported
  | "empty"; // the drafted section is blank (nothing to verify)

export interface ClaimCheck {
  /** The specific assertion lifted from the drafted section. */
  claim: string;
  status: ClaimStatus;
  /** What in the source material backs it — or why it could not be confirmed. */
  evidence: string;
}

export interface SectionVerification {
  /** Bare statement key: overview | employment | compensation | … */
  section: string;
  verdict: SectionVerdict;
  confidence: Confidence;
  claims: ClaimCheck[];
}

/**
 * Independent verification of a drafted Source-of-Wealth statement against the
 * source material it was written from. Designed for cross-model use: the writer
 * (Claude) drafts, an independent verifier (OpenAI) checks — an independent
 * model is far more likely to catch the writer's own fabrications than self-review.
 */
export interface SourceOfWealthVerification {
  sections: SectionVerification[];
  overallConfidence: Confidence;
  /** Total number of unsupported claims across all sections. */
  flaggedCount: number;
  verifierModel: string;
  /** ISO timestamp. */
  verifiedAt: string;
}

// ----------------------------------------------------------------------------
// Retrieval / provenance (robust search layer: DataForSEO + Jina)
// ----------------------------------------------------------------------------

export type RetrievalSource = "dataforseo" | "jina" | "anthropic-search";

/**
 * The deep-dive research angles for a UHNW prospect. Their wealth rarely sits
 * in one place — it spans operating companies, trusts, foundations, property
 * and (often) offshore structures — so we research each angle separately.
 */
export type ResearchAngle =
  | "wealth_profile" // rankings, estimated net worth, source-of-wealth narrative
  | "corporate" // directorships, ownership, PSC / beneficial ownership, shareholdings
  | "trusts_foundations" // charitable trusts, private foundations, trustee roles
  | "philanthropy" // donations, boards, galas, named gifts
  | "offshore" // offshore entities & structures (ICIJ leaks etc.)
  | "property" // real-estate holdings (often held via trusts / SPVs)
  | "deals" // liquidity events: exits, IPOs, M&A, fundraises
  | "litigation" // court / probate / divorce — wealth events + red flags
  | "professional"; // fund/firm, career, alumni, clubs — network & referral routes

/** A single retrieved, source-attributed passage of evidence. */
export interface RetrievedPassage {
  title: string;
  url: string;
  /** Clean text / markdown extract of the page (Jina) or the SERP snippet. */
  text: string;
  source: RetrievalSource;
  /** Which deep-dive angle surfaced this passage (when run via deepResearch). */
  angle?: ResearchAngle;
  /** ISO timestamp of when it was fetched. */
  fetchedAt: string;
}

/** Result of a deep, multi-angle research pass on a prospect. */
export interface DeepResearchResult {
  subject: string;
  passages: RetrievedPassage[];
  /** Angles that returned at least one passage. */
  anglesCovered: ResearchAngle[];
  retrievedAt: string;
}

// ----------------------------------------------------------------------------
// "Name-in → advisor-ready prep" pack
// ----------------------------------------------------------------------------

export interface ColdCallScript {
  opener: string;
  talkingPoints: string[];
  anticipatedObjections: { objection: string; response: string }[];
}

/** A Source-of-Wealth question paired with why it matters and a likely answer. */
export interface SowQuestion {
  question: string;
  /** Why a compliance file needs this — what it establishes. */
  why: string;
  /** Anticipated answer inferred from the research/profile — the banker validates it. */
  suggestedAnswer: string;
  /** Documentary evidence a good private bank would expect to corroborate it. */
  expectedEvidence: string[];
}

export interface PrepPack {
  /** Our synthesised read of the prospect's likely wealth profile & trajectory. */
  marketRead: string;
  coldCall: ColdCallScript;
  sourceOfWealth: {
    /** Which SoW categories most likely apply (employment, business_sale, trusts, …). */
    likelyCategories: string[];
    /** 5–6 well-formed questions with anticipated answers, modelled on PB practice. */
    questions: SowQuestion[];
  };
  sources: { title: string; url: string }[];
  verification?: SourceOfWealthVerification;
  generatedAt: string;
}

/** Verification is generic across SoW / briefing / prep — same shape. */
export type Verification = SourceOfWealthVerification;
