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

/** A single retrieved, source-attributed passage of evidence. */
export interface RetrievedPassage {
  title: string;
  url: string;
  /** Clean text / markdown extract of the page (Jina) or the SERP snippet. */
  text: string;
  source: RetrievalSource;
  /** ISO timestamp of when it was fetched. */
  fetchedAt: string;
}
