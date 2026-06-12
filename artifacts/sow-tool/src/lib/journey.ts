import type { ProspectSummary, AssessmentSummary } from "@workspace/api-client-react";
import { reviewTypeOptions } from "./sowCatalog";

// The end-to-end prospecting journey. Every relationship — whether still a
// prospect or already an onboarding client — sits on exactly one of these five
// stages. Stage is derived on the frontend from the data we already have; there
// is no dedicated "stage" column on the backend.
export type JourneyStageId = "identify" | "cold_call" | "brief" | "meet" | "onboard";

export const JOURNEY_STAGES: { id: JourneyStageId; label: string }[] = [
  { id: "identify", label: "Identify" },
  { id: "cold_call", label: "Cold Call" },
  { id: "brief", label: "Brief" },
  { id: "meet", label: "Meet" },
  { id: "onboard", label: "Onboard" },
];

const STAGE_INDEX: Record<JourneyStageId, number> = {
  identify: 0,
  cold_call: 1,
  brief: 2,
  meet: 3,
  onboard: 4,
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
function prospectStage(status: ProspectSummary["status"]): JourneyStageId {
  switch (status) {
    case "researching":
      return "cold_call";
    case "briefed":
      return "brief";
    case "outreach":
      return "meet";
    case "converted":
      return "onboard";
    case "identified":
    case "dormant":
    default:
      return "identify";
  }
}

function prospectNextAction(
  stage: JourneyStageId,
  hasBriefing: boolean,
  convertedNoAssessment: boolean,
): string {
  if (convertedNoAssessment) return "Complete conversion";
  switch (stage) {
    case "identify":
      return "Draft cold-call anchor";
    case "cold_call":
      return "Log call outcome";
    case "brief":
      return hasBriefing ? "Review AI briefing" : "Generate AI briefing";
    case "meet":
      return "Prepare question guide";
    case "onboard":
      return "Complete conversion";
  }
}

function prospectMeta(
  stage: JourneyStageId,
  hasBriefing: boolean,
  dormant: boolean,
  convertedNoAssessment: boolean,
): string {
  if (dormant) return "Dormant — revisit later";
  if (convertedNoAssessment) return "Conversion incomplete";
  switch (stage) {
    case "identify":
      return "Newly identified";
    case "cold_call":
      return "Working the approach";
    case "brief":
      return hasBriefing ? "AI briefing ready" : "Briefing pending";
    case "meet":
      return "Ready to meet";
    case "onboard":
      return "Conversion incomplete";
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
    items.push({
      key: `assessment-${a.id}`,
      kind: "assessment",
      id: a.id,
      name: a.clientName,
      segment: reviewTypeLabel(a.reviewType) ?? "Client",
      relationshipManager: a.relationshipManager ?? null,
      stage: "onboard",
      stageIndex: STAGE_INDEX.onboard,
      nextAction: assessmentNextAction(a.status),
      meta: enhanced ? `${statusLabel} · EDD` : statusLabel,
      urgency: enhanced && !completed ? "high" : "normal",
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
    const stage = prospectStage(p.status);
    items.push({
      key: `prospect-${p.id}`,
      kind: "prospect",
      id: p.id,
      name: p.name,
      segment: p.segment ?? null,
      relationshipManager: p.relationshipManager ?? null,
      stage,
      stageIndex: STAGE_INDEX[stage],
      nextAction: prospectNextAction(stage, p.hasBriefing, convertedNoAssessment),
      meta: prospectMeta(stage, p.hasBriefing, dormant, convertedNoAssessment),
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
    identify: 0,
    cold_call: 0,
    brief: 0,
    meet: 0,
    onboard: 0,
  };
  for (const item of items) {
    if (!item.dormant) counts[item.stage] += 1;
  }
  return counts;
}
