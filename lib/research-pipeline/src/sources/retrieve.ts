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

  // Preferred path: DataForSEO for recall, Jina for clean extraction.
  if (dataForSeoConfigured()) {
    const hits = await dataForSeoSearch(query, limit);

    // Bad/again-rate-limited DataForSEO creds return []. Don't silently lose
    // grounding — fall back to Jina search when it's available.
    if (hits.length === 0 && jinaConfigured()) {
      return jinaSearch(query, limit);
    }
    if (!extract || !jinaConfigured()) return hits;

    const extracted = await mapLimit(hits, 4, (hit) =>
      hit.url ? jinaRead(hit.url) : Promise.resolve(null),
    );
    // Prefer the full Jina extract; fall back to the SERP snippet where the
    // page couldn't be fetched (paywall, timeout, etc.).
    return hits.map((hit, i) => extracted[i] ?? hit);
  }

  // Fallback: Jina search only.
  if (jinaConfigured()) {
    return jinaSearch(query, limit);
  }

  return [];
}
