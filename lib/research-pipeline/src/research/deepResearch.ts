// ============================================================================
// Deep research — multi-angle fan-out for a UHNW prospect
//
// Instead of one web query, we research each wealth angle separately (corporate,
// trusts & foundations, offshore, property, deals, philanthropy, …), site-
// targeting the authoritative registries for the angles that have them, then
// dedupe into one corpus. This is what gets the FULL context behind a UHNW
// individual — where the trusts, foundations and holding structures actually live.
//
// Built on the pluggable retrieve() (DataForSEO + Jina). With no search keys it
// returns an empty corpus and callers fall back to the model's own web search.
// ============================================================================

import type {
  DeepResearchResult,
  ResearchAngle,
  RetrievedPassage,
} from "../types";
import { retrieve } from "../sources/retrieve";
import { domainsForAngle } from "../sources/deepDiveSources";
import { mapLimit } from "../util/concurrency";

// Keyword seeds that steer each angle's query.
const ANGLE_KEYWORDS: Record<ResearchAngle, string> = {
  wealth_profile: "net worth wealth estimated fortune source of wealth political donation",
  corporate: "director shareholder company officer beneficial owner PSC",
  trusts_foundations: "foundation charitable trust trustee settlor",
  philanthropy: "donation philanthropy gift patron board",
  offshore: "offshore trust holding company structure beneficial owner",
  property: "property estate real estate residence land registry overseas entity",
  deals: "acquisition sale IPO exit funding round investment",
  litigation: "court judgment settlement divorce probate insolvency bankruptcy",
  professional: "partner fund firm career biography profile",
};

// The default UHNW research set. Ordered roughly by signal value; the
// trust/foundation/offshore/property/litigation angles are where the public UK
// registries (and what generic search misses) live.
export const DEFAULT_ANGLES: ResearchAngle[] = [
  "wealth_profile",
  "corporate",
  "trusts_foundations",
  "offshore",
  "property",
  "philanthropy",
  "deals",
  "litigation",
  "professional",
];

// Angles where site-targeting the authoritative registries materially helps.
const SITE_TARGETED: ResearchAngle[] = [
  "corporate",
  "trusts_foundations",
  "offshore",
  "property",
  "litigation",
  "wealth_profile",
];

function anglesQueries(subject: string, angle: ResearchAngle): string[] {
  const base = `${subject} ${ANGLE_KEYWORDS[angle]}`.trim();
  const queries = [base];
  if (SITE_TARGETED.includes(angle)) {
    const domains = domainsForAngle(angle).slice(0, 4);
    if (domains.length) {
      queries.push(`${subject} ${domains.map((d) => `site:${d}`).join(" OR ")}`);
    }
  }
  return queries;
}

export interface DeepResearchOptions {
  /** Disambiguating context (employer, role, segment, location). */
  context?: string;
  /** Which angles to research. Defaults to the UHNW set. */
  angles?: ResearchAngle[];
  /** Results pursued per query. */
  perAngle?: number;
}

export async function deepResearch(
  subject: string,
  options: DeepResearchOptions = {},
): Promise<DeepResearchResult> {
  const angles = options.angles ?? DEFAULT_ANGLES;
  const perAngle = options.perAngle ?? 4;
  const ctx = options.context?.trim() ? ` ${options.context.trim()}` : "";
  const subjectCtx = `${subject}${ctx}`;

  const queries: { angle: ResearchAngle; query: string }[] = [];
  for (const angle of angles) {
    for (const query of anglesQueries(subjectCtx, angle)) {
      queries.push({ angle, query });
    }
  }

  // Cap concurrent retrieves so one pass can't fire dozens of simultaneous
  // outbound requests (each retrieve also caps its own extraction concurrency).
  // 6-wide keeps the broader UK angle set from dragging out wall-clock time.
  const results = await mapLimit(queries, 6, async ({ angle, query }) => {
    const passages = await retrieve(query, { limit: perAngle });
    return { angle, passages: passages.map((p) => ({ ...p, angle })) };
  });

  // Dedupe by URL across all angles, keeping the first (angle-tagged) hit.
  const seen = new Set<string>();
  const passages: RetrievedPassage[] = [];
  for (const { passages: ps } of results) {
    for (const p of ps) {
      const key = p.url || `${p.title}|${p.text.slice(0, 60)}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      passages.push(p);
    }
  }

  const anglesCovered = [
    ...new Set(passages.map((p) => p.angle).filter((a): a is ResearchAngle => !!a)),
  ];

  return {
    subject,
    passages,
    anglesCovered,
    retrievedAt: new Date().toISOString(),
  };
}

/** Format a retrieved corpus into a numbered, angle-labelled prompt block. */
export function corpusToPromptBlock(
  passages: RetrievedPassage[],
  maxCharsPerPassage = 2500,
): string {
  return passages
    .map((p, i) => {
      const head = `[${i + 1}] (${p.angle ?? "web"}) ${p.title} — ${p.url}`;
      const body = p.text.slice(0, maxCharsPerPassage).trim();
      return body ? `${head}\n${body}` : head;
    })
    .join("\n\n");
}
