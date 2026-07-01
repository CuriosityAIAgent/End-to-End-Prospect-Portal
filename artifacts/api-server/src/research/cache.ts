// ============================================================================
// Research cache (knowledge base, Phase 0).
//
// Persists each deep-research pass per subject so a later prep reuses the fresh
// passages and skips the slow web fan-out. Freshness is per source kind — a
// registry filing ages slower than a news article.
// ============================================================================

import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, documentsTable, type DocumentRow } from "@workspace/db";
import type { RetrievedPassage, RetrievalSource } from "@workspace/research-pipeline";

/** Stable key for "this prospect + disambiguating context + research depth".
 * Depth is part of the key so a shallow `quick` corpus is never reused to serve
 * a `deep` request (which must run the broader registry sweep). */
export function normalizeSubject(name: string, context: string | undefined, depth: string): string {
  const base = [name, context ?? ""]
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return `${base}::${depth}`;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Canonicalise a URL for dedup: drop fragment + tracking params, lowercase host. */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref|syn-)/i.test(k)) u.searchParams.delete(k);
    }
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return url.trim();
  }
}

type SourceKind = "registry" | "filing" | "news" | "profile" | "web";

const TTL_DAYS: Record<SourceKind, number> = {
  registry: 90,
  filing: 30,
  news: 14,
  profile: 60,
  web: 21,
};

function classifyKind(url: string): SourceKind {
  const h = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (/sec\.gov|edgar/.test(h)) return "filing";
  if (
    /companieshouse|company-information\.service\.gov\.uk|charitycommission|register-of-charities|gov\.scot|landregistry|gazette\.gov\.uk|gov\.uk|registers\.service/.test(
      h,
    )
  )
    return "registry";
  if (
    /ft\.com|bloomberg|reuters|forbes|theguardian|telegraph|thetimes|nytimes|wsj|cnbc|bbc|cityam|sky\.com/.test(
      h,
    )
  )
    return "news";
  if (/linkedin|crunchbase|compan-?profile|about/.test(h)) return "profile";
  return "web";
}

const MIN_CACHED = 5;

/** Fresh cached passages for a subject (empty if too few / all stale). */
export async function loadFreshCorpus(subject: string): Promise<RetrievedPassage[]> {
  const rows: DocumentRow[] = await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.subject, subject), gt(documentsTable.staleAfter, new Date())));

  if (rows.length < MIN_CACHED) return [];
  return rows.map((r) => ({
    title: r.title,
    url: r.url,
    text: r.text,
    source: (r.source as RetrievalSource) ?? "jina",
    angle: (r.angle as RetrievedPassage["angle"]) ?? undefined,
    fetchedAt: r.fetchedAt.toISOString(),
  }));
}

/** Drop all cached passages for a subject. Used by a forced refresh so stale
 *  rows from an older query don't linger (storeCorpus only upserts the new set;
 *  loadFreshCorpus would otherwise still return the old, non-stale rows). */
export async function clearCorpus(subject: string): Promise<void> {
  await db.delete(documentsTable).where(eq(documentsTable.subject, subject));
}

/** Upsert a freshly-retrieved corpus for a subject (dedup on subject + URL). */
export async function storeCorpus(subject: string, passages: RetrievedPassage[]): Promise<void> {
  if (passages.length === 0) return;
  const now = new Date();
  // Dedup by normalised-URL hash within the batch: two passages that normalise
  // to the same URL would make ON CONFLICT "affect a row twice" and Postgres
  // rejects the whole insert. Keep the first occurrence.
  const byHash = new Map<string, typeof documentsTable.$inferInsert>();
  for (const p of passages) {
    if (!p.url) continue;
    const urlHash = sha256(normalizeUrl(p.url));
    if (byHash.has(urlHash)) continue;
    const kind = classifyKind(p.url);
    byHash.set(urlHash, {
      subject,
      url: p.url,
      urlHash,
      contentHash: sha256(p.text ?? ""),
      title: p.title ?? "",
      text: p.text ?? "",
      source: p.source ?? "jina",
      sourceKind: kind,
      angle: p.angle ?? null,
      fetchedAt: now,
      staleAfter: new Date(now.getTime() + TTL_DAYS[kind] * 86_400_000),
    });
  }
  const rows = [...byHash.values()];
  if (rows.length === 0) return;

  await db
    .insert(documentsTable)
    .values(rows)
    .onConflictDoUpdate({
      target: [documentsTable.subject, documentsTable.urlHash],
      set: {
        contentHash: sql`excluded.content_hash`,
        title: sql`excluded.title`,
        text: sql`excluded.text`,
        source: sql`excluded.source`,
        sourceKind: sql`excluded.source_kind`,
        angle: sql`excluded.angle`,
        fetchedAt: sql`excluded.fetched_at`,
        staleAfter: sql`excluded.stale_after`,
        updatedAt: now,
      },
    });
}
