// ============================================================================
// DataForSEO adapter
//
// Higher-recall, structured web search via the DataForSEO SERP API (Google
// Organic, live/advanced endpoint). Returns result URLs + titles + snippets,
// which the retrieve() orchestrator then hands to Jina for clean extraction.
//
// Env-gated on DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD (HTTP basic auth).
// ============================================================================

import type { RetrievedPassage } from "../types";

export function dataForSeoConfigured(): boolean {
  return !!process.env.DATAFORSEO_LOGIN && !!process.env.DATAFORSEO_PASSWORD;
}

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN ?? "";
  const password = process.env.DATAFORSEO_PASSWORD ?? "";
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

interface SerpItem {
  type?: string;
  title?: string;
  url?: string;
  description?: string;
}

/**
 * Run a Google Organic search and return the top organic results as lightweight
 * passages (title + snippet). Pass the URLs to jinaRead() for full extraction.
 */
export async function dataForSeoSearch(
  query: string,
  limit = 8,
): Promise<RetrievedPassage[]> {
  if (!dataForSeoConfigured()) return [];
  try {
    const res = await fetch(
      "https://api.dataforseo.com/v3/serp/google/organic/live/advanced",
      {
        method: "POST",
        headers: {
          Authorization: authHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          { keyword: query, language_code: "en", location_code: 2826, depth: limit },
        ]),
      },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as {
      tasks?: { result?: { items?: SerpItem[] }[] }[];
    };
    const items = body.tasks?.[0]?.result?.[0]?.items ?? [];
    const now = new Date().toISOString();
    return items
      .filter((i) => i.type === "organic" && i.url)
      .slice(0, limit)
      .map((i) => ({
        title: i.title || i.url || query,
        url: i.url as string,
        text: (i.description || "").trim(),
        source: "dataforseo" as const,
        fetchedAt: now,
      }));
  } catch {
    return [];
  }
}
