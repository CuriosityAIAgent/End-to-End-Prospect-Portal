import { pgTable, serial, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Knowledge base — cached research passages (Phase 0).
//
// Every deep-research pass writes its retrieved passages here, deduped per
// subject + URL. A later prep for the same subject reuses the fresh ones and
// skips the slow web fan-out entirely. `staleAfter` is computed at write time
// from `sourceKind` (a registry filing ages slower than a news article), so the
// "is it still fresh" check is a single indexed lookup.
//
// Per-subject for now (each subject keeps its own rows); cross-prospect entity
// sharing is a later phase.
export const documentsTable = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    /** Normalised subject key the passage was fetched for. */
    subject: text("subject").notNull(),
    url: text("url").notNull(),
    /** sha256(normalised url) — the per-subject dedup key. */
    urlHash: text("url_hash").notNull(),
    /** sha256(extracted text) — detects when a page's content changed. */
    contentHash: text("content_hash").notNull(),
    title: text("title").notNull().default(""),
    text: text("text").notNull().default(""),
    /** RetrievalSource: dataforseo | jina | anthropic-search. */
    source: text("source").notNull().default("jina"),
    /** registry | filing | news | profile | web — drives the staleness window. */
    sourceKind: text("source_kind").notNull().default("web"),
    /** ResearchAngle that surfaced it (nullable). */
    angle: text("angle"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    /** fetchedAt + TTL(sourceKind); rows past this are re-fetched. */
    staleAfter: timestamp("stale_after", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    subjectUrl: uniqueIndex("documents_subject_url_uq").on(t.subject, t.urlHash),
    subjectFresh: index("documents_subject_stale_idx").on(t.subject, t.staleAfter),
  }),
);

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type DocumentRow = typeof documentsTable.$inferSelect;
