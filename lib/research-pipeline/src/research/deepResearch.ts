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

// The default (deep) UHNW research set. Ordered roughly by signal value; the
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

// "Quick" set — a fast read for a cold call in five minutes. Highest-signal
// angles only, no site-targeting, shallower extraction. "Deep" keeps the full
// registry sweep above.
export const QUICK_ANGLES: ResearchAngle[] = [
  "wealth_profile",
  "corporate",
  "professional",
  "deals",
];

export type ResearchDepth = "quick" | "deep";

// Angles where site-targeting the authoritative registries materially helps.
const SITE_TARGETED: ResearchAngle[] = [
  "corporate",
  "trusts_foundations",
  "offshore",
  "property",
  "litigation",
  "wealth_profile",
];

function anglesQueries(
  name: string,
  context: string,
  angle: ResearchAngle,
  siteTargeted: boolean,
): string[] {
  const ctx = context.trim() ? ` ${context.trim()}` : "";
  // Watch-item / adverse search (litigation angle) must phrase-match the EXACT
  // NAME — an unquoted name pulls in unrelated people (a probate/insolvency case
  // for a different person who shares a name fragment). Quote ONLY the name (the
  // disambiguating context stays unquoted, and is dropped here so it can't
  // over-narrow the phrase); other angles stay unquoted to keep recall. Strip
  // any embedded quotes from the name so the phrase query stays well-formed.
  const cleanName = name.replace(/"/g, " ").replace(/\s+/g, " ").trim();
  const subj = angle === "litigation" ? `"${cleanName}"` : `${cleanName}${ctx}`;
  const base = `${subj} ${ANGLE_KEYWORDS[angle]}`.trim();
  const queries = [base];
  if (siteTargeted && SITE_TARGETED.includes(angle)) {
    const domains = domainsForAngle(angle).slice(0, 4);
    if (domains.length) {
      queries.push(`${subj} ${domains.map((d) => `site:${d}`).join(" OR ")}`);
    }
  }
  return queries;
}

/** Progress as retrieval waves complete — wired to the prep job's progress bar. */
export interface DeepResearchProgress {
  completed: number;
  total: number;
  detail: string;
}

export interface DeepResearchOptions {
  /** Disambiguating context (employer, role, segment, location). */
  context?: string;
  /** Which angles to research. Defaults to the set implied by `depth`. */
  angles?: ResearchAngle[];
  /** "deep" (full registry sweep, default) or "quick" (fast cold-call read). */
  depth?: ResearchDepth;
  /** Results pursued per query. Defaults by depth. */
  perAngle?: number;
  /** Full-page extracts per query. Defaults by depth (extraction is the slow part). */
  extractLimit?: number;
  /** Called as each retrieval completes, for the progress UI. */
  onProgress?: (p: DeepResearchProgress) => void;
}

export async function deepResearch(
  subject: string,
  options: DeepResearchOptions = {},
): Promise<DeepResearchResult> {
  const depth: ResearchDepth = options.depth ?? "deep";
  const angles = options.angles ?? (depth === "quick" ? QUICK_ANGLES : DEFAULT_ANGLES);
  const perAngle = options.perAngle ?? (depth === "quick" ? 3 : 4);
  const extractLimit = options.extractLimit ?? (depth === "quick" ? 2 : 3);
  const siteTargeted = depth === "deep";
  const context = options.context ?? "";

  const queries: { angle: ResearchAngle; query: string }[] = [];
  for (const angle of angles) {
    for (const query of anglesQueries(subject, context, angle, siteTargeted)) {
      queries.push({ angle, query });
    }
  }

  // Cap concurrent retrieves so one pass can't fire dozens of simultaneous
  // outbound requests (each retrieve also caps its own extraction concurrency).
  // 6-wide keeps the broader UK angle set from dragging out wall-clock time.
  let completed = 0;
  const total = queries.length;
  const results = await mapLimit(queries, 6, async ({ angle, query }) => {
    const passages = await retrieve(query, { limit: perAngle, extractLimit });
    completed += 1;
    options.onProgress?.({
      completed,
      total,
      detail: `Searched ${completed} of ${total} sources…`,
    });
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
