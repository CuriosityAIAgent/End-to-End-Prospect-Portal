// ============================================================================
// Jina adapter
//
// Two capabilities:
//  • jinaRead(url)   — r.jina.ai: fetch a page and return clean markdown.
//  • jinaSearch(q)   — s.jina.ai: web search returning result URLs + snippets.
//
// Env-gated on JINA_API_KEY (the free tier also works without a key but at a
// much lower rate limit; we always send the key when present).
// ============================================================================

import type { RetrievedPassage } from "../types";

export function jinaConfigured(): boolean {
  return !!process.env.JINA_API_KEY;
}

function authHeaders(): Record<string, string> {
  const key = process.env.JINA_API_KEY;
  return key ? { Authorization: `Bearer ${key}` } : {};
}

/** Fetch a single URL as clean markdown via r.jina.ai. */
export async function jinaRead(url: string): Promise<RetrievedPassage | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { ...authHeaders(), "X-Return-Format": "markdown" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    return {
      title: url,
      url,
      text: text.trim(),
      source: "jina",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

interface JinaSearchHit {
  title?: string;
  url?: string;
  content?: string;
  description?: string;
}

/** Web search via s.jina.ai. Returns lightweight hits (no full-page fetch). */
export async function jinaSearch(
  query: string,
  limit = 5,
): Promise<RetrievedPassage[]> {
  try {
    const res = await fetch(`https://s.jina.ai/?q=${encodeURIComponent(query)}`, {
      headers: { ...authHeaders(), Accept: "application/json" },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: JinaSearchHit[] };
    const hits = Array.isArray(body.data) ? body.data : [];
    const now = new Date().toISOString();
    return hits.slice(0, limit).map((h) => ({
      title: h.title || h.url || query,
      url: h.url || "",
      text: (h.content || h.description || "").trim(),
      source: "jina" as const,
      fetchedAt: now,
    }));
  } catch {
    return [];
  }
}
