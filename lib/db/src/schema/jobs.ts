import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Background jobs for long-running generation (prep packs, briefings). Moving
// the slow deep-research → draft → verify pipeline off the request thread lets
// the UI show staged progress, lets the banker leave and come back, and lets a
// partial result (the read) be revealed before verification finishes.
//
// State machine:
//   queued → researching → drafting → estimating → verifying → done
//   (any) → failed
// "At most one active job per (prospect, kind)" is enforced at enqueue time by a
// transaction-scoped advisory lock (see enqueueUniqueJob in jobs/runner.ts), not
// a DB constraint — so there's no migration that can fail on pre-existing
// duplicate rows.
export const jobsTable = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(), // "prospect_prep" | "prospect_briefing"
  prospectId: integer("prospect_id").notNull(),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0), // 0..100
  stageDetail: text("stage_detail"),
  // Partial result revealed mid-run (e.g. the drafted read while verify runs).
  partial: jsonb("partial").$type<Record<string, unknown> | null>(),
  // Final result on success (the full PrepPack).
  result: jsonb("result").$type<Record<string, unknown> | null>(),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  // Bumped on every progress write; doubles as the liveness signal the boot-time
  // recovery sweep uses to fail jobs orphaned by a restart.
  heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;
