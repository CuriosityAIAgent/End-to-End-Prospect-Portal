// ============================================================================
// Retrieval orchestrator
//
// The robust-search entry point. Strategy, best → fallback:
//   1. DataForSEO SERP (high recall) → Jina read top URLs into clean markdown.
//   2. Jina search alone (when DataForSEO isn't configured).
// Returns source-attributed passages ready to ground generation + verification.
//
// All adapters are env-gated and fail soft (return []), so `retrieve` degrades
// gracefully to whatever sources are provisioned.
// ============================================================================

import type { RetrievedPassage } from "../types";
import { mapLimit } from "../util/concurrency";
import { dataForSeoConfigured, dataForSeoSearch } from "./dataforseo";
import { jinaConfigured, jinaRead, jinaSearch } from "./jina";

export interface RetrieveOptions {
  /** Max number of result URLs to pursue. */
  limit?: number;
  /** Fetch full page markdown via Jina (slower, richer). Default true. */
  extract?: boolean;
  /**
   * Only fetch full-page markdown for the top N hits; the rest keep their
   * (cheaper) SERP snippet. Page extraction is the dominant latency cost, so
   * capping it well below `limit` trims wall-time with little quality loss.
   * Defaults to `limit` (extract everything).
   */
  extractLimit?: number;
}

/** True when at least one search backend is provisioned. */
export function retrievalConfigured(): boolean {
  return dataForSeoConfigured() || jinaConfigured();
}

export async function retrieve(
  query: string,
  options: RetrieveOptions = {},
): Promise<RetrievedPassage[]> {
  const limit = options.limit ?? 6;
  const extract = options.extract ?? true;
  const extractLimit = options.extractLimit ?? limit;

  // Preferred path: DataForSEO for recall, Jina for clean extraction.
  if (dataForSeoConfigured()) {
    const hits = await dataForSeoSearch(query, limit);

    // Bad/again-rate-limited DataForSEO creds return []. Don't silently lose
    // grounding — fall back to Jina search when it's available.
    if (hits.length === 0 && jinaConfigured()) {
      return jinaSearch(query, limit);
    }
    if (!extract || !jinaConfigured()) return hits;

    // Only deep-fetch the top `extractLimit` hits; lower-ranked hits keep their
    // SERP snippet. Extraction is the slow part, so this caps the long tail.
    const toExtract = hits.slice(0, extractLimit);
    const extracted = await mapLimit(toExtract, 4, (hit) =>
      hit.url ? jinaRead(hit.url) : Promise.resolve(null),
    );
    // Prefer the full Jina extract; fall back to the SERP snippet where the
    // page couldn't be fetched (paywall, timeout, etc.) or wasn't extracted.
    return hits.map((hit, i) => (i < extractLimit ? extracted[i] ?? hit : hit));
  }

  // Fallback: Jina search only.
  if (jinaConfigured()) {
    return jinaSearch(query, limit);
  }

  return [];
}
