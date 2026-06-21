import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, prospectsTable, assessmentsTable, type Prospect } from "@workspace/db";
import {
  deepResearch,
  corpusToPromptBlock,
  retrievalConfigured,
  draft,
  verifySections,
  sowEvidencePromptBlock,
  prepResponseSpec,
  parsePrepResponse,
  estimateWealth,
  assumptionsToQuestions,
  type Verification,
  type PrepPack,
  type ResearchDepth,
} from "@workspace/research-pipeline";
import { logger } from "../lib/logger";
import {
  createJob,
  findActiveJob,
  isUniqueViolation,
  latestJob,
  schedule,
  serializeJob,
  updateJob,
} from "../jobs/runner";
import { normalizeSubject, loadFreshCorpus, storeCorpus } from "../research/cache";
import {
  CreateProspectBody,
  GetProspectParams,
  GetProspectResponse,
  UpdateProspectParams,
  UpdateProspectBody,
  UpdateProspectResponse,
  DeleteProspectParams,
  ListProspectsResponse,
  GenerateProspectBriefingParams,
  ConvertProspectParams,
  GetAssessmentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// Human-readable labels for the profile / channel / operational-question ids
// the frontend stores on `data`. Kept inline so the api-server stays
// independent of the frontend package while still producing a rich AI prompt.
const FIELD_LABELS: Record<string, string> = {
  industry: "Industry / sector",
  knownInfo: "What the banker already knows",
  employer: "Employer & previous employer",
  personal: "Personal profile",
  family: "Family connections",
  interests: "Hobbies & interests",
  charity: "Charity work",
  client_referrals: "Channel — Referrals from existing clients",
  jpm_network: "Channel — JPMorgan network referral",
  cold_approach: "Channel — Cold approach",
  touchpoints: "Touchpoints with current clients",
  network_source: "Where in the network to find a referral",
  get_referral: "How to get a referral to this prospect",
  referral_quality: "What kind of referral we want",
};

function serialize(row: Prospect) {
  return {
    ...row,
    segment: row.segment ?? null,
    relationshipManager: row.relationshipManager ?? null,
    briefing: row.briefing ?? null,
    convertedAssessmentId: row.convertedAssessmentId ?? null,
  };
}

router.get("/prospects", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(prospectsTable)
    .orderBy(desc(prospectsTable.updatedAt));

  res.json(
    ListProspectsResponse.parse(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        segment: r.segment ?? null,
        relationshipManager: r.relationshipManager ?? null,
        status: r.status,
        hasBriefing: r.briefing != null,
        convertedAssessmentId: r.convertedAssessmentId ?? null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    ),
  );
});

router.post("/prospects", async (req, res): Promise<void> => {
  const parsed = CreateProspectBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid prospect body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(prospectsTable)
    .values({
      name: parsed.data.name,
      segment: parsed.data.segment ?? null,
      relationshipManager: parsed.data.relationshipManager ?? null,
      status: parsed.data.status ?? "identified",
      data: parsed.data.data ?? {},
    })
    .returning();

  res.status(201).json(GetProspectResponse.parse(serialize(row)));
});

router.get("/prospects/:id", async (req, res): Promise<void> => {
  const params = GetProspectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(prospectsTable)
    .where(eq(prospectsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }

  res.json(GetProspectResponse.parse(serialize(row)));
});

router.put("/prospects/:id", async (req, res): Promise<void> => {
  const params = UpdateProspectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProspectBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid prospect update");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const update: Partial<typeof prospectsTable.$inferInsert> = {};
  const b = parsed.data;
  if (b.name !== undefined) update.name = b.name;
  if (b.segment !== undefined) update.segment = b.segment ?? null;
  if (b.relationshipManager !== undefined)
    update.relationshipManager = b.relationshipManager ?? null;
  if (b.status !== undefined) update.status = b.status;
  if (b.data !== undefined) update.data = b.data;

  // Empty body is a safe no-op (Drizzle throws on `.set({})`).
  if (Object.keys(update).length === 0) {
    const [existing] = await db
      .select()
      .from(prospectsTable)
      .where(eq(prospectsTable.id, params.data.id));
    if (!existing) {
      res.status(404).json({ error: "Prospect not found" });
      return;
    }
    res.json(UpdateProspectResponse.parse(serialize(existing)));
    return;
  }

  const [row] = await db
    .update(prospectsTable)
    .set(update)
    .where(eq(prospectsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }

  res.json(UpdateProspectResponse.parse(serialize(row)));
});

router.delete("/prospects/:id", async (req, res): Promise<void> => {
  const params = DeleteProspectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(prospectsTable)
    .where(eq(prospectsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }

  res.sendStatus(204);
});

type BriefingShape = {
  summary: string;
  talkingPoints: string[];
  referralRoutes: string[];
  recommendedApproach: string;
};

function bankerNotes(data: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string" && value.trim().length > 0) {
      lines.push(`- ${FIELD_LABELS[key] ?? key}: ${value.trim()}`);
    }
  }
  return lines.length ? lines.join("\n") : "(No notes captured yet.)";
}

// Disambiguating context appended to every deep-research query (industry +
// segment). The free-text `knownInfo` is too long for queries — it grounds the
// writer via bankerNotes instead.
function researchContext(prospect: Prospect): string | undefined {
  const data = (prospect.data ?? {}) as Record<string, unknown>;
  const industry = typeof data.industry === "string" ? data.industry.trim() : "";
  const segment = prospect.segment?.trim() ?? "";
  const ctx = [industry, segment].filter((s) => s.length > 0).join(" ");
  return ctx.length > 0 ? ctx : undefined;
}

function dedupeByUrl(
  items: { title: string; url: string }[],
): { title: string; url: string }[] {
  const seen = new Set<string>();
  const out: { title: string; url: string }[] = [];
  for (const it of items) {
    const key = it.url || it.title;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

router.post("/prospects/:id/briefing", async (req, res): Promise<void> => {
  const params = GenerateProspectBriefingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [prospect] = await db
    .select()
    .from(prospectsTable)
    .where(eq(prospectsTable.id, params.data.id));

  if (!prospect) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }

  const notes = bankerNotes(prospect.data ?? {});

  try {
    // Deep, multi-angle research (corporate, trusts & foundations, offshore,
    // philanthropy, deals…) via DataForSEO + Jina when configured. Falls back to
    // the model's own web search when no search keys are provisioned.
    const research = retrievalConfigured()
      ? await deepResearch(prospect.name, {
          context: researchContext(prospect),
        })
      : { passages: [], anglesCovered: [] as string[] };
    const useCorpus = research.passages.length > 0;
    const corpusBlock = useCorpus ? corpusToPromptBlock(research.passages) : "";

    const instructions = [
      "You are a private-banking research analyst at JPMorgan preparing a concise pre-meeting briefing on an ultra-high-net-worth (UHNW) prospect for a relationship manager.",
      useCorpus
        ? "Use ONLY the SOURCE MATERIAL below (deep research across the prospect's companies, trusts, foundations, philanthropy, offshore structures and deals) together with the banker's own notes. Never assert anything the source material does not support — say plainly when something is uncertain or not found."
        : "Use the web search tool to find current, factual, publicly available information (their fund/firm, role, notable deals/liquidity events, trusts and foundations, board and philanthropic roles). Combine it with the banker's notes. Never invent facts.",
      "Return ONLY a single JSON object (no markdown fences, no prose around it) with exactly these keys:",
      '  "summary": string — 2-3 short paragraphs profiling the prospect and why they fit the UHNW PE / hedge-fund segment.',
      '  "talkingPoints": string[] — 4-6 specific, non-generic conversation openers grounded in the research.',
      '  "referralRoutes": string[] — 2-5 concrete warm-introduction routes (shared employers, co-investments, schools, boards, charities, foundations, clubs) the banker could work.',
      '  "recommendedApproach": string — a short paragraph on how to approach the first meeting.',
    ].join("\n");

    const input = [
      `Prospect name: ${prospect.name}`,
      prospect.segment ? `Segment: ${prospect.segment}` : "",
      "",
      "Banker's notes:",
      notes,
      ...(useCorpus ? ["", "SOURCE MATERIAL:", corpusBlock] : []),
    ]
      .filter(Boolean)
      .join("\n");

    const { text, webSources } = await draft({
      instructions,
      input,
      preferClaude: useCorpus, // Claude writes when we've supplied the corpus
      allowWebSearch: !useCorpus, // else let OpenAI search the web itself
    });

    let parsed: BriefingShape;
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const slice = jsonStart >= 0 && jsonEnd >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text;
      const raw = JSON.parse(slice) as Partial<BriefingShape>;
      parsed = {
        summary: typeof raw.summary === "string" ? raw.summary : "",
        talkingPoints: Array.isArray(raw.talkingPoints)
          ? raw.talkingPoints.filter((x): x is string => typeof x === "string")
          : [],
        referralRoutes: Array.isArray(raw.referralRoutes)
          ? raw.referralRoutes.filter((x): x is string => typeof x === "string")
          : [],
        recommendedApproach:
          typeof raw.recommendedApproach === "string" ? raw.recommendedApproach : "",
      };
    } catch {
      req.log.error("Failed to parse briefing JSON from model");
      res.status(502).json({ error: "The briefing could not be generated. Please try again." });
      return;
    }

    if (parsed.summary.trim().length === 0 && parsed.talkingPoints.length === 0) {
      req.log.error("Model returned an empty briefing");
      res.status(502).json({ error: "The briefing could not be generated. Please try again." });
      return;
    }

    // Sources = deep-research passages + any web_search citations, deduped.
    const sources = dedupeByUrl([
      ...research.passages.map((p) => ({ title: p.title, url: p.url })),
      ...webSources,
    ]);

    // Verify the briefing against the corpus the writer used (only meaningful
    // when we grounded with retrieved source material). Non-fatal.
    let verification: Verification | undefined;
    if (useCorpus) {
      try {
        verification = await verifySections(
          [
            { key: "summary", text: parsed.summary },
            { key: "talkingPoints", text: parsed.talkingPoints.join("\n") },
            { key: "referralRoutes", text: parsed.referralRoutes.join("\n") },
            { key: "recommendedApproach", text: parsed.recommendedApproach },
          ],
          input,
        );
      } catch (err) {
        req.log.warn({ err }, "Briefing verification failed (non-fatal)");
      }
    }

    const briefing = {
      ...parsed,
      sources,
      generatedAt: new Date().toISOString(),
    };

    const [row] = await db
      .update(prospectsTable)
      .set({
        briefing,
        status: prospect.status === "identified" ? "briefed" : prospect.status,
      })
      .where(eq(prospectsTable.id, params.data.id))
      .returning();

    res.json({
      ...GetProspectResponse.parse(serialize(row)),
      ...(verification ? { briefingVerification: verification } : {}),
    });
  } catch (err) {
    req.log.error({ err }, "Briefing generation failed");
    res.status(502).json({ error: "The briefing could not be generated. Please try again." });
  }
});

router.post("/prospects/:id/convert", async (req, res): Promise<void> => {
  const params = ConvertProspectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Run the whole convert as one transaction with a row lock on the prospect
  // so two concurrent convert requests cannot each create an assessment.
  const result = await db.transaction(async (tx) => {
    const [prospect] = await tx
      .select()
      .from(prospectsTable)
      .where(eq(prospectsTable.id, params.data.id))
      .for("update");

    if (!prospect) {
      return { status: 404 as const, error: "Prospect not found" };
    }

    if (prospect.convertedAssessmentId != null) {
      return {
        status: 409 as const,
        error: "Prospect has already been converted to an assessment.",
      };
    }

    // Lift any meeting file note captured at the prospect stage to the top
    // level so the assessment's File Note panel keeps showing it after convert
    // (the rest of the prospect's data is nested under `prospectProfile`).
    const prospectData = (prospect.data ?? {}) as Record<string, unknown>;

    const [assessment] = await tx
      .insert(assessmentsTable)
      .values({
        clientName: prospect.name,
        relationshipManager: prospect.relationshipManager ?? null,
        reviewType: "onboarding",
        status: "draft",
        data: {
          prospectProfile: prospectData,
          prospectBriefing: prospect.briefing ?? null,
          prospectSegment: prospect.segment ?? null,
          ...(prospectData.fileNote ? { fileNote: prospectData.fileNote } : {}),
        },
      })
      .returning();

    await tx
      .update(prospectsTable)
      .set({ status: "converted", convertedAssessmentId: assessment.id })
      .where(eq(prospectsTable.id, params.data.id));

    return { status: 201 as const, assessment };
  });

  if (result.status !== 201) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.status(201).json(
    GetAssessmentResponse.parse({
      ...result.assessment,
      reviewType: result.assessment.reviewType ?? undefined,
      riskRating: result.assessment.riskRating ?? undefined,
    }),
  );
});

// "Name in → advisor-ready prep": deep research → write (Claude) → verify
// (OpenAI), producing a cold-call script, the right Source-of-Wealth questions
// WITH anticipated answers (modelled on private-bank practice), and a market
// read. Persisted to prospect.data.prep (open jsonb) for the RM to validate.
//
// This is slow (research fan-out + two LLM passes), so it runs as a BACKGROUND
// JOB: the POST enqueues and returns a jobId immediately; the client polls
// GET /jobs/:id for staged progress and a partial reveal of the read.
router.post("/prospects/:id/prep", async (req, res): Promise<void> => {
  const params = GetProspectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const requestedDepth = (req.body as { depth?: unknown } | undefined)?.depth;
  const depth: ResearchDepth = requestedDepth === "quick" ? "quick" : "deep";

  const [prospect] = await db
    .select()
    .from(prospectsTable)
    .where(eq(prospectsTable.id, params.data.id));

  if (!prospect) {
    res.status(404).json({ error: "Prospect not found" });
    return;
  }

  // Idempotency: a double-click shouldn't spawn a second run. The app-level
  // check handles the common case; the DB unique index (and the catch below)
  // closes the race where two requests both pass this check.
  const existing = await findActiveJob("prospect_prep", prospect.id);
  if (existing) {
    res.status(202).json({ jobId: existing.id });
    return;
  }

  let job;
  try {
    job = await createJob("prospect_prep", prospect.id);
  } catch (err) {
    if (isUniqueViolation(err)) {
      const active = await findActiveJob("prospect_prep", prospect.id);
      if (active) {
        res.status(202).json({ jobId: active.id });
        return;
      }
    }
    throw err;
  }
  schedule(() => runPrepJob(job.id, prospect.id, depth));
  res.status(202).json({ jobId: job.id });
});

// The latest prep job for a prospect — lets the screen reattach to a run in
// progress after a refresh / navigation.
router.get("/prospects/:id/jobs/latest", async (req, res): Promise<void> => {
  const params = GetProspectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const kind = typeof req.query.kind === "string" ? req.query.kind : "prospect_prep";
  const job = await latestJob(kind, params.data.id);
  res.json(job ? serializeJob(job) : null);
});

// The background worker. Mirrors the old synchronous pipeline but writes status,
// progress and a partial result to the job row instead of an HTTP response.
async function runPrepJob(
  jobId: string,
  prospectId: number,
  depth: ResearchDepth,
): Promise<void> {
  const fail = async (error: string) => {
    await updateJob(jobId, { status: "failed", error: error.slice(0, 300) });
  };

  try {
    await updateJob(jobId, {
      status: "researching",
      progress: 5,
      startedAt: new Date(),
      stageDetail: "Searching sources…",
    });

    const [prospect] = await db
      .select()
      .from(prospectsTable)
      .where(eq(prospectsTable.id, prospectId));
    if (!prospect) {
      await fail("Prospect not found");
      return;
    }

    const notes = bankerNotes(prospect.data ?? {});

    // Knowledge base: reuse fresh cached research for this subject and skip the
    // slow web fan-out; otherwise research and cache the result for next time.
    const subjectKey = normalizeSubject(prospect.name, researchContext(prospect), depth);
    let passages = await loadFreshCorpus(subjectKey).catch((err) => {
      logger.warn({ err, jobId }, "Research cache read failed (non-fatal)");
      return [] as Awaited<ReturnType<typeof loadFreshCorpus>>;
    });

    if (passages.length > 0) {
      await updateJob(jobId, { progress: 45, stageDetail: "Using saved research…" });
    } else if (retrievalConfigured()) {
      const research = await deepResearch(prospect.name, {
        context: researchContext(prospect),
        depth,
        onProgress: (p) => {
          // Map research completion onto 5–45% of the overall bar.
          const pct = 5 + Math.round((p.completed / Math.max(1, p.total)) * 40);
          void updateJob(jobId, { progress: pct, stageDetail: p.detail });
        },
      });
      passages = research.passages;
      await storeCorpus(subjectKey, passages).catch((err) =>
        logger.warn({ err, jobId }, "Research cache write failed (non-fatal)"),
      );
    }

    const useCorpus = passages.length > 0;
    const corpusBlock = useCorpus ? corpusToPromptBlock(passages) : "";

    await updateJob(jobId, {
      status: "drafting",
      progress: 50,
      stageDetail: "Drafting the read…",
    });

    const instructions = [
      "You are a senior private banker at JPMorgan preparing a relationship manager to approach a UHNW prospect. Produce a prep pack the RM can validate with the client. Never present anything as confirmed fact unless the SOURCE MATERIAL supports it; frame the rest as a likely picture to confirm.",
      useCorpus
        ? "Ground everything in the SOURCE MATERIAL below (deep research across the prospect's companies, trusts, foundations, philanthropy, offshore structures and deals) plus the banker's notes."
        : "Use the web search tool to research the prospect, plus the banker's notes.",
      "",
      "Model the Source-of-Wealth questions and the documents you expect on how good private banks frame SoW, using this reference:",
      sowEvidencePromptBlock(),
      "",
      prepResponseSpec(),
    ].join("\n");

    const input = [
      `Prospect: ${prospect.name}`,
      prospect.segment ? `Segment: ${prospect.segment}` : "",
      "",
      "Banker's notes / profile:",
      notes,
      ...(useCorpus ? ["", "SOURCE MATERIAL:", corpusBlock] : []),
    ]
      .filter(Boolean)
      .join("\n");

    const { text, webSources } = await draft({
      instructions,
      input,
      preferClaude: useCorpus,
      allowWebSearch: !useCorpus,
      maxTokens: 8000, // big nested JSON — avoid truncation
    });

    const parsed = parsePrepResponse(text);
    if (!parsed) {
      logger.error({ jobId, sample: text.slice(0, 300) }, "Failed to parse prep JSON");
      await fail(`parse_failed len=${text.length}`);
      return;
    }
    const pack = parsed;

    if (!pack.marketRead.trim() && pack.sourceOfWealth.questions.length === 0) {
      await fail("empty_pack");
      return;
    }

    // The model's own SoW questions — verified against the source. Estimate-
    // derived questions are appended later and are NOT re-verified here (they're
    // already independently validated by the wealth validator).
    const originalQuestions = pack.sourceOfWealth.questions.slice();

    const sources = dedupeByUrl([
      ...passages.map((p) => ({ title: p.title, url: p.url })),
      ...webSources,
    ]);

    // Reveal the read now, before the (non-blocking) estimate + verify run.
    const partial: PrepPack = { ...pack, sources, generatedAt: new Date().toISOString() };
    await updateJob(jobId, {
      status: "estimating",
      progress: 62,
      stageDetail: "Estimating net worth…",
      partial: partial as unknown as Record<string, unknown>,
    });

    // Net-worth estimate (Claude builds a grounded ledger; code computes ranges;
    // OpenAI validates). Non-fatal — the pack still ships without it. Material
    // assumptions become extra Source-of-Wealth questions for the banker.
    let wealthEstimate: PrepPack["wealthEstimate"];
    if (useCorpus) {
      try {
        wealthEstimate = await estimateWealth({
          subject: prospect.name,
          segment: prospect.segment ?? undefined,
          notes,
          corpusBlock,
          sourceText: input,
        });
        if (wealthEstimate && !wealthEstimate.refused) {
          const extra = assumptionsToQuestions(wealthEstimate);
          const have = new Set(pack.sourceOfWealth.questions.map((q) => q.question.toLowerCase()));
          for (const q of extra) {
            if (!have.has(q.question.toLowerCase())) pack.sourceOfWealth.questions.push(q);
          }
        }
      } catch (err) {
        logger.warn({ err, jobId }, "Wealth estimate failed (non-fatal)");
      }
    }

    const withEstimate: PrepPack = {
      ...pack,
      sources,
      wealthEstimate,
      generatedAt: new Date().toISOString(),
    };
    await updateJob(jobId, {
      status: "verifying",
      progress: 82,
      stageDetail: "Verifying claims…",
      partial: withEstimate as unknown as Record<string, unknown>,
    });

    let verification: Verification | undefined;
    if (useCorpus) {
      try {
        verification = await verifySections(
          [
            { key: "marketRead", text: pack.marketRead },
            { key: "coldCall", text: [pack.coldCall.opener, ...pack.coldCall.talkingPoints].join("\n") },
            ...originalQuestions.map((q, i) => ({
              key: `sow_answer_${i + 1}`,
              text: q.suggestedAnswer,
            })),
          ],
          input,
        );
      } catch (err) {
        logger.warn({ err, jobId }, "Prep verification failed (non-fatal)");
      }
    }

    const prep: PrepPack = {
      ...pack,
      sources,
      wealthEstimate,
      verification,
      generatedAt: new Date().toISOString(),
    };

    // Re-read the prospect's data right before writing: the banker may have
    // edited notes / approach usage during the (long) run, and we must not
    // clobber those with the snapshot taken when the job started.
    const [current] = await db
      .select({ data: prospectsTable.data })
      .from(prospectsTable)
      .where(eq(prospectsTable.id, prospectId));
    const prospectData = (current?.data ?? prospect.data ?? {}) as Record<string, unknown>;
    await db
      .update(prospectsTable)
      .set({ data: { ...prospectData, prep } })
      .where(eq(prospectsTable.id, prospectId));

    await updateJob(jobId, {
      status: "done",
      progress: 100,
      stageDetail: "Done",
      partial: prep as unknown as Record<string, unknown>,
      result: prep as unknown as Record<string, unknown>,
    });
  } catch (err) {
    logger.error({ err, jobId }, "Prep job failed");
    await fail(String(err instanceof Error ? err.message : err));
  }
}

export default router;
