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

// ----------------------------------------------------------------------------
// Structured "Our read" + multi-variant "Approach"
//
// The banker wanted the read organised (headline → scannable facts → themed
// detail) rather than prose, and the outreach broken into Email + Call with a
// few angled versions to choose from. Both are new optional fields on PrepPack;
// the legacy `marketRead` / `coldCall` are kept populated for back-compat.
// ----------------------------------------------------------------------------

/** A single fact in the read, with its provenance. */
export interface ReadFact {
  text: string;
  /** "supported" = traceable to a source; "inference" = a framed likelihood. */
  basis: "supported" | "inference";
}

/** One themed block of the read. */
export interface ReadTheme {
  /** Stable id: origin | structure | entities | watch. */
  id: "origin" | "structure" | "entities" | "watch";
  /** Display name, e.g. "How the wealth was built". */
  heading: string;
  /** One-line takeaway shown collapsed. */
  takeaway: string;
  facts: ReadFact[];
}

/** The structured read: a headline, scannable key facts, then themed detail. */
export interface MarketRead {
  /** The one-line "At a glance" headline. */
  headline: string;
  /** 3–6 scannable labelled facts. */
  keyFacts: { label: string; value: string }[];
  themes: ReadTheme[];
}

/** Shared angle metadata for an outreach variant. */
export interface VariantAngle {
  /** Short label for the switcher: "News hook" | "Warm intro" | "Direct". */
  label: string;
  /** One-line description of the angle. */
  rationale: string;
  /** The recent event/news this leans on, if any. */
  newsHook?: string;
}

export interface EmailVariant extends VariantAngle {
  id: string; // "email-1" …
  subject: string;
  body: string;
}

export interface CallVariant extends VariantAngle {
  id: string; // "call-1" …
  opener: string;
  /** The call flow as ordered beats. */
  flow: string[];
}

export interface Approach {
  email: EmailVariant[];
  call: CallVariant[];
  /** Channel-agnostic pushback handling. */
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

// ----------------------------------------------------------------------------
// Net-worth / Source-of-Wealth estimation engine
//
// The estimator (Claude) never emits a net-worth *number* as prose. It emits a
// structured assumption LEDGER — every wealth-relevant quantity is a line with a
// value, a basis tag, a source reference and a confidence. The dollar/pound
// ranges are then computed deterministically IN CODE from that ledger, and an
// independent model (OpenAI) checks each line. This is what makes the estimate
// defensible enough for a banker to stake his name on.
// ----------------------------------------------------------------------------

export interface MoneyRange {
  low: number;
  base: number;
  high: number;
  /** ISO currency code, e.g. "GBP" | "USD". */
  currency: string;
}

/** How grounded a single ledger line is. */
export type AssumptionBasis =
  | "from-source" // a figure stated in the research corpus (strongest)
  | "benchmark-table" // a curated comp/industry benchmark (reusable prior)
  | "benchmark-inferred" // a model-proposed band, citing a comparable
  | "assumption"; // a modelling parameter (savings rate, return, tax)

/** What a ledger line drives in the deterministic computation. */
export type AssumptionCategory =
  | "reported_net_worth" // a top-down reported TOTAL net-worth figure (from-source)
  | "role_comp" // base + bonus for a role (income stream: annual × years)
  | "carry_equity" // carried interest / equity / RSUs (income stream)
  | "liquidity_event" // a one-off event: exit, IPO, sale (amount)
  | "known_asset" // a held asset: property, shareholding (amount)
  | "savings_rate" // fraction of after-tax income retained (rate)
  | "investment_return" // annual real return compounding retained wealth (rate)
  | "tax" // effective tax rate on income (rate)
  | "illiquidity" // informational haircut note
  | "other";

export interface AssumptionLine {
  id: string;
  /** Human label: "Carry, managing partner, UK hedge fund, 2010–2020". */
  label: string;
  category: AssumptionCategory;
  /** Income streams (role_comp / carry_equity): annual gross + tenure. */
  annual?: MoneyRange;
  years?: number;
  /** Events / assets (liquidity_event / known_asset): a one-off amount. */
  amount?: MoneyRange;
  /** Whether an asset/event counts toward LIQUID net worth. */
  liquid?: boolean;
  /** Rate lines (savings_rate / investment_return / tax): a fraction 0..1. */
  rate?: number;
  basis: AssumptionBasis;
  /** Passage index "[n]" / benchmark key / "" for pure assumptions. */
  sourceRef: string;
  confidence: Confidence;
  /** The validator's note on this line, populated after validation. */
  validatorNote?: string;
}

export type LineVerdict = "ok" | "weak" | "ungrounded" | "implausible";

/** Independent (cross-model) check of the estimate's ledger. */
export interface WealthValidation {
  lineVerdicts: {
    id: string;
    verdict: LineVerdict;
    note: string;
    suggestedConfidence?: Confidence;
  }[];
  /** Aggregate flags. */
  overConfident: boolean;
  rangeAdvice: "ok" | "widen";
  overallConfidence: Confidence;
  /** Number of lines the validator could not stand behind. */
  flaggedCount: number;
  validatorModel: string;
  validatedAt: string;
}

export interface WealthEstimate {
  totalNetWorth: MoneyRange;
  liquidNetWorth: MoneyRange;
  /** One-line plain-English basis for the headline. */
  headline: string;
  assumptions: AssumptionLine[];
  /** Deterministic roll-up of the ledger's confidence + basis mix. */
  overallConfidence: Confidence;
  estimatorModel: string;
  validation?: WealthValidation;
  /** True when evidence was too thin to estimate at all. */
  refused?: boolean;
  refusalReason?: string;
  /** Presentation currency. */
  currency: string;
  asOf: string;
  generatedAt: string;
}

export interface PrepPack {
  /** Our synthesised read of the prospect's likely wealth profile & trajectory.
   * Legacy flat string — kept populated for back-compat + verification; the UI
   * prefers the structured `read` below when present. */
  marketRead: string;
  /** Structured read: headline → key facts → themed detail. */
  read?: MarketRead;
  /** Legacy single cold-call script — kept for back-compat; UI prefers `approach`. */
  coldCall: ColdCallScript;
  /** Multi-variant outreach: Email + Call, each with a few angled versions. */
  approach?: Approach;
  sourceOfWealth: {
    /** Which SoW categories most likely apply (employment, business_sale, trusts, …). */
    likelyCategories: string[];
    /** 5–6 well-formed questions with anticipated answers, modelled on PB practice. */
    questions: SowQuestion[];
  };
  /** Defensible net-worth estimate with its assumption ledger (when researchable). */
  wealthEstimate?: WealthEstimate;
  sources: { title: string; url: string }[];
  verification?: SourceOfWealthVerification;
  generatedAt: string;
}

/** Verification is generic across SoW / briefing / prep — same shape. */
export type Verification = SourceOfWealthVerification;
