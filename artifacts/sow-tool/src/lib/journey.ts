import type { ProspectSummary, AssessmentSummary } from "@workspace/api-client-react";
import { reviewTypeOptions } from "./sowCatalog";

// The end-to-end prospecting journey. Every relationship — whether still a
// prospect or already an onboarding client — sits on exactly one of these five
// stages. Stage is derived on the frontend from the data we already have; there
// is no dedicated "stage" column on the backend.
// The four journey steps — the SAME backbone as the prospect/assessment page
// step-rail, so the list and the detail pages speak one vocabulary.
export type JourneyStageId = "brief" | "approach" | "meet" | "sow";

export const JOURNEY_STAGES: { id: JourneyStageId; label: string }[] = [
  { id: "brief", label: "Brief & qualify" },
  { id: "approach", label: "Approach" },
  { id: "meet", label: "Meeting" },
  { id: "sow", label: "Source of Wealth" },
];

const STAGE_INDEX: Record<JourneyStageId, number> = {
  brief: 0,
  approach: 1,
  meet: 2,
  sow: 3,
};

export type JourneyKind = "prospect" | "assessment";
export type Urgency = "high" | "normal";

export interface JourneyItem {
  key: string;
  kind: JourneyKind;
  id: number;
  name: string;
  /** Short descriptor under the name (prospect segment or client review type). */
  segment: string | null;
  relationshipManager: string | null;
  stage: JourneyStageId;
  stageIndex: number;
  nextAction: string;
  /** A short status line describing where the relationship currently sits. */
  meta: string;
  urgency: Urgency;
  dormant: boolean;
  /** Enhanced due diligence (high risk) — onboard clients only. */
  enhanced: boolean;
  href: string;
  updatedAt: string;
}

const ASSESSMENT_STATUS_LABEL: Record<AssessmentSummary["status"], string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
};

function reviewTypeLabel(value: AssessmentSummary["reviewType"]): string | null {
  if (!value) return null;
  return reviewTypeOptions.find((o) => o.value === value)?.label ?? null;
}

// Maps the 6-value prospect status enum onto the 5 journey stages. `converted`
// resolves to onboard (the client is being onboarded); `dormant` keeps its
// nominal position at identify but is flagged and de-prioritised separately.
// Derived from the SAME signals the prospect page's step-rail uses (prep →
// approach → file note → convert), so the list and the detail page never
// diverge. The current stage is the first step not yet done.
function prospectStage(p: ProspectSummary): JourneyStageId {
  if (p.status === "converted") return "sow"; // ready to build the assessment
  if (!p.hasPrep) return "brief";
  if (!p.approachUsed) return "approach";
  if (!p.hasFileNote) return "meet";
  return "sow";
}

function prospectNextAction(stage: JourneyStageId, convertedNoAssessment: boolean): string {
  if (convertedNoAssessment) return "Complete conversion";
  switch (stage) {
    case "brief":
      return "Generate brief";
    case "approach":
      return "Make the approach";
    case "meet":
      return "Capture meeting note";
    case "sow":
      return "Convert to Source of Wealth";
  }
}

function prospectMeta(stage: JourneyStageId, dormant: boolean, convertedNoAssessment: boolean): string {
  if (dormant) return "Dormant — revisit later";
  if (convertedNoAssessment) return "Conversion incomplete";
  switch (stage) {
    case "brief":
      return "Brief & qualify";
    case "approach":
      return "Ready to approach";
    case "meet":
      return "Ready to meet";
    case "sow":
      return "Ready to convert";
  }
}

function assessmentNextAction(status: AssessmentSummary["status"]): string {
  switch (status) {
    case "draft":
      return "Begin SoW profile";
    case "in_progress":
      return "Continue SoW review";
    case "completed":
      return "Review & sign-off";
  }
}

/**
 * Merge prospects and onboarding assessments into one ordered journey worklist.
 *
 * Dedup rule: a prospect is dropped only when its `convertedAssessmentId` points
 * at an assessment that actually exists in the list — that relationship is then
 * represented by its assessment at the Onboard stage. A prospect manually marked
 * "converted" without a real assessment still surfaces (at Onboard, with a
 * "Complete conversion" action) so it can never silently vanish.
 */
export function buildJourney(
  prospects: ProspectSummary[],
  assessments: AssessmentSummary[],
): JourneyItem[] {
  const assessmentIds = new Set(assessments.map((a) => a.id));
  const items: JourneyItem[] = [];

  for (const a of assessments) {
    const enhanced = a.riskRating === "enhanced";
    const completed = a.status === "completed";
    const statusLabel = ASSESSMENT_STATUS_LABEL[a.status];
    // Mirrors the assessment page: until a meeting note exists (or it's signed
    // off) the live step is the meeting note that the statement is drafted from.
    const meetingDone = a.hasFileNote || completed;
    const stage: JourneyStageId = meetingDone ? "sow" : "meet";
    items.push({
      key: `assessment-${a.id}`,
      kind: "assessment",
      id: a.id,
      name: a.clientName,
      segment: reviewTypeLabel(a.reviewType) ?? "Client",
      relationshipManager: a.relationshipManager ?? null,
      stage,
      stageIndex: STAGE_INDEX[stage],
      nextAction: meetingDone ? assessmentNextAction(a.status) : "Capture meeting note",
      meta: meetingDone ? (enhanced ? `${statusLabel} · EDD` : statusLabel) : "Meeting note pending",
      urgency: (enhanced && !completed) || !meetingDone ? "high" : "normal",
      dormant: false,
      enhanced,
      href: `/assessment/${a.id}`,
      updatedAt: a.updatedAt,
    });
  }

  for (const p of prospects) {
    const linkedAssessmentExists =
      p.convertedAssessmentId != null && assessmentIds.has(p.convertedAssessmentId);
    if (linkedAssessmentExists) continue;

    const dormant = p.status === "dormant";
    const convertedNoAssessment = p.status === "converted";
    const stage = prospectStage(p);
    items.push({
      key: `prospect-${p.id}`,
      kind: "prospect",
      id: p.id,
      name: p.name,
      segment: p.segment ?? null,
      relationshipManager: p.relationshipManager ?? null,
      stage,
      stageIndex: STAGE_INDEX[stage],
      nextAction: prospectNextAction(stage, convertedNoAssessment),
      meta: prospectMeta(stage, dormant, convertedNoAssessment),
      urgency: convertedNoAssessment || stage === "meet" ? "high" : "normal",
      dormant,
      enhanced: false,
      href: `/prospect/${p.id}`,
      updatedAt: p.updatedAt,
    });
  }

  items.sort((x, y) => {
    if (x.dormant !== y.dormant) return x.dormant ? 1 : -1;
    const urgency = (y.urgency === "high" ? 1 : 0) - (x.urgency === "high" ? 1 : 0);
    if (urgency) return urgency;
    if (x.stageIndex !== y.stageIndex) return x.stageIndex - y.stageIndex;
    return new Date(y.updatedAt).getTime() - new Date(x.updatedAt).getTime();
  });

  return items;
}

/** Per-stage counts for the stage rail. Dormant relationships are excluded. */
export function stageCounts(items: JourneyItem[]): Record<JourneyStageId, number> {
  const counts: Record<JourneyStageId, number> = {
    brief: 0,
    approach: 0,
    meet: 0,
    sow: 0,
  };
  for (const item of items) {
    if (!item.dormant) counts[item.stage] += 1;
  }
  return counts;
}
