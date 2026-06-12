import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, assessmentsTable, type Assessment } from "@workspace/db";
import {
  CreateAssessmentBody,
  GetAssessmentParams,
  GetAssessmentResponse,
  UpdateAssessmentParams,
  UpdateAssessmentBody,
  UpdateAssessmentResponse,
  DeleteAssessmentParams,
  ListAssessmentsResponse,
  GetOverviewResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// reviewType/riskRating are optional (not nullable) in the contract, so map DB
// nulls to undefined before serializing.
function serialize(row: Assessment) {
  return {
    ...row,
    reviewType: row.reviewType ?? undefined,
    riskRating: row.riskRating ?? undefined,
  };
}

router.get("/assessments", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: assessmentsTable.id,
      clientName: assessmentsTable.clientName,
      clientReference: assessmentsTable.clientReference,
      relationshipManager: assessmentsTable.relationshipManager,
      reviewType: assessmentsTable.reviewType,
      riskRating: assessmentsTable.riskRating,
      status: assessmentsTable.status,
      createdAt: assessmentsTable.createdAt,
      updatedAt: assessmentsTable.updatedAt,
    })
    .from(assessmentsTable)
    .orderBy(desc(assessmentsTable.updatedAt));

  res.json(
    ListAssessmentsResponse.parse(
      rows.map((r) => ({
        ...r,
        reviewType: r.reviewType ?? undefined,
        riskRating: r.riskRating ?? undefined,
      })),
    ),
  );
});

router.post("/assessments", async (req, res): Promise<void> => {
  const parsed = CreateAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid assessment body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(assessmentsTable)
    .values({
      clientName: parsed.data.clientName,
      clientReference: parsed.data.clientReference ?? null,
      relationshipManager: parsed.data.relationshipManager ?? null,
      reviewType: parsed.data.reviewType ?? null,
      riskRating: parsed.data.riskRating ?? null,
      status: parsed.data.status ?? "draft",
      data: parsed.data.data ?? {},
    })
    .returning();

  res.status(201).json(GetAssessmentResponse.parse(serialize(row)));
});

router.get("/assessments-overview", async (_req, res): Promise<void> => {
  const statusRows = await db
    .select({
      status: assessmentsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(assessmentsTable)
    .groupBy(assessmentsTable.status);

  const riskRows = await db
    .select({
      riskRating: assessmentsTable.riskRating,
      count: sql<number>`count(*)::int`,
    })
    .from(assessmentsTable)
    .where(sql`${assessmentsTable.riskRating} is not null`)
    .groupBy(assessmentsTable.riskRating);

  const recent = await db
    .select({
      id: assessmentsTable.id,
      clientName: assessmentsTable.clientName,
      clientReference: assessmentsTable.clientReference,
      relationshipManager: assessmentsTable.relationshipManager,
      reviewType: assessmentsTable.reviewType,
      riskRating: assessmentsTable.riskRating,
      status: assessmentsTable.status,
      createdAt: assessmentsTable.createdAt,
      updatedAt: assessmentsTable.updatedAt,
    })
    .from(assessmentsTable)
    .orderBy(desc(assessmentsTable.updatedAt))
    .limit(5);

  const total = statusRows.reduce((sum, r) => sum + r.count, 0);

  res.json(
    GetOverviewResponse.parse({
      total,
      byStatus: statusRows,
      byRisk: riskRows.map((r) => ({ riskRating: r.riskRating, count: r.count })),
      recentlyUpdated: recent.map((r) => ({
        ...r,
        reviewType: r.reviewType ?? undefined,
        riskRating: r.riskRating ?? undefined,
      })),
    }),
  );
});

router.get("/assessments/:id", async (req, res): Promise<void> => {
  const params = GetAssessmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(assessmentsTable)
    .where(eq(assessmentsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  res.json(GetAssessmentResponse.parse(serialize(row)));
});

router.put("/assessments/:id", async (req, res): Promise<void> => {
  const params = UpdateAssessmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid assessment update");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const update: Partial<typeof assessmentsTable.$inferInsert> = {};
  const b = parsed.data;
  if (b.clientName !== undefined) update.clientName = b.clientName;
  if (b.clientReference !== undefined) update.clientReference = b.clientReference ?? null;
  if (b.relationshipManager !== undefined)
    update.relationshipManager = b.relationshipManager ?? null;
  if (b.reviewType !== undefined) update.reviewType = b.reviewType ?? null;
  if (b.riskRating !== undefined) update.riskRating = b.riskRating ?? null;
  if (b.status !== undefined) update.status = b.status;
  if (b.data !== undefined) update.data = b.data;

  // Nothing to change: return the current record instead of issuing an empty
  // UPDATE (Drizzle throws on `.set({})`).
  if (Object.keys(update).length === 0) {
    const [existing] = await db
      .select()
      .from(assessmentsTable)
      .where(eq(assessmentsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Assessment not found" });
      return;
    }
    res.json(UpdateAssessmentResponse.parse(serialize(existing)));
    return;
  }

  const [row] = await db
    .update(assessmentsTable)
    .set(update)
    .where(eq(assessmentsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  res.json(UpdateAssessmentResponse.parse(serialize(row)));
});

router.delete("/assessments/:id", async (req, res): Promise<void> => {
  const params = DeleteAssessmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(assessmentsTable)
    .where(eq(assessmentsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
