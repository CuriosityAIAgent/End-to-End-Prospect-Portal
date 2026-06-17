import { Router, type IRouter } from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { eq, desc } from "drizzle-orm";
import { db, prospectsTable, assessmentsTable, type Prospect } from "@workspace/db";
import { claude, DEFAULT_CLAUDE_MODEL } from "@workspace/integrations-openai-ai-server";
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
  const instructions = [
    "You are a private-banking research analyst at JPMorgan preparing a concise pre-meeting briefing on an ultra-high-net-worth (UHNW) prospect for a relationship manager.",
    "Use the web search tool to find current, factual, publicly available information about the named individual (their fund/firm, role, notable deals or liquidity events, board and philanthropic roles, public interests).",
    "Combine what you find with the banker's own notes below. Never invent facts — if something is uncertain or not found, say so plainly rather than guessing.",
    "Return ONLY a single JSON object (no markdown fences, no prose around it) with exactly these keys:",
    '  "summary": string — 2-3 short paragraphs profiling the prospect and why they fit the UHNW PE / hedge-fund segment.',
    '  "talkingPoints": string[] — 4-6 specific, non-generic conversation openers grounded in the research.',
    '  "referralRoutes": string[] — 2-5 concrete warm-introduction routes (shared employers, co-investments, schools, boards, charities, clubs) the banker could work.',
    '  "recommendedApproach": string — a short paragraph on how to approach the first meeting.',
  ].join("\n");

  const input = [
    `Prospect name: ${prospect.name}`,
    prospect.segment ? `Segment: ${prospect.segment}` : "",
    "",
    "Banker's notes:",
    notes,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    // Claude's server-side web_search tool may pause after 10 internal
    // iterations (stop_reason: "pause_turn") — re-send to resume. Cap at 3
    // continuations to bound runaway tool loops.
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: input },
    ];
    let response: Anthropic.Message | null = null;
    for (let i = 0; i < 4; i++) {
      response = await claude.messages.create({
        model: DEFAULT_CLAUDE_MODEL,
        max_tokens: 8000,
        system: instructions,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages,
      });
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }
    if (!response) {
      req.log.error("No response from briefing model");
      res.status(502).json({ error: "The briefing could not be generated. Please try again." });
      return;
    }

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    const text = textBlocks.map((b) => b.text).join("");

    // Collect web citations from the text-block annotations.
    const sources: { title: string; url: string }[] = [];
    const seen = new Set<string>();
    for (const block of textBlocks) {
      const citations = (block as Anthropic.TextBlock & {
        citations?: Array<{ type?: string; url?: string; title?: string }>;
      }).citations;
      if (!citations) continue;
      for (const c of citations) {
        if (c.url && !seen.has(c.url)) {
          seen.add(c.url);
          sources.push({ title: c.title || c.url, url: c.url });
        }
      }
    }

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

    // Reject structurally-valid but empty output rather than persisting a hollow
    // briefing and promoting the prospect to "briefed".
    if (parsed.summary.trim().length === 0 && parsed.talkingPoints.length === 0) {
      req.log.error("Model returned an empty briefing");
      res.status(502).json({ error: "The briefing could not be generated. Please try again." });
      return;
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

    res.json(GetProspectResponse.parse(serialize(row)));
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

export default router;
