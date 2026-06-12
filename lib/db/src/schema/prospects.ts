import { pgTable, serial, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Prospecting records. As with assessments, the full profile (the five profile
// dimensions, the three channels, and the four operational questions) is stored
// in a single `data` jsonb blob keyed by the prospecting-catalog ids; the
// frontend owns the shape. The generated pre-meeting briefing is cached in its
// own `briefing` jsonb column.
export const prospectsTable = pgTable("prospects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  segment: text("segment"),
  relationshipManager: text("relationship_manager"),
  status: text("status").notNull().default("identified"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  briefing: jsonb("briefing").$type<Record<string, unknown> | null>(),
  convertedAssessmentId: integer("converted_assessment_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertProspectSchema = createInsertSchema(prospectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospectsTable.$inferSelect;
