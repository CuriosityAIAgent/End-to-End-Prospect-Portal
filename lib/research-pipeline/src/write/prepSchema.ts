// ============================================================================
// Prep-pack response schema: the JSON spec we ask the writer for, and a
// defensive parser that turns its reply into a structured pack.
//
// The writer returns a structured `read` (headline → key facts → themed detail)
// and a multi-variant `approach` (Email + Call, a few angled versions each),
// plus the Source-of-Wealth questions. We also derive the legacy flat
// `marketRead` / `coldCall` so verification and older UI keep working.
// ============================================================================

import type {
  Approach,
  CallVariant,
  ColdCallScript,
  EmailVariant,
  MarketRead,
  PrepPack,
  ReadFact,
  ReadTheme,
  SowQuestion,
} from "../types";

const THEME_IDS = ["origin", "structure", "entities", "watch"] as const;
const THEME_DEFAULTS: Record<(typeof THEME_IDS)[number], string> = {
  origin: "How the wealth was built",
  structure: "Where it sits",
  entities: "Names & numbers",
  watch: "Watch-items",
};

/** The JSON spec lines injected into the prep prompt. */
export function prepResponseSpec(): string {
  return [
    "Return ONLY a JSON object (no markdown) with exactly these keys:",
    '  "read": {',
    '    "headline": string — one tight line, the "at a glance" read of who they are and where the wealth sits;',
    '    "keyFacts": [{ "label": string, "value": string }] — 3-6 scannable facts (e.g. label "Wealth origin", "Where it sits", "Notable");',
    '    "themes": [{ "id": "origin"|"structure"|"entities"|"watch", "heading": string, "takeaway": string (one line), "facts": [{ "text": string, "basis": "supported"|"inference" }] }] — use the four ids; headings like "How the wealth was built" / "Where it sits" / "Names & numbers" / "Watch-items". Mark each fact\'s basis honestly: "supported" if it traces to the SOURCE MATERIAL, else "inference".',
    "  },",
    '  "approach": {',
    '    "email": [ exactly 3 variants { "id": "email-1", "label": string, "rationale": string, "newsHook": string|null, "subject": string, "body": string } ] — variant 1 leans on a RECENT news/event from the SOURCE MATERIAL (set newsHook), variant 2 is warm/relationship-led, variant 3 is direct/value-led;',
    '    "call": [ exactly 3 variants { "id": "call-1", "label": string, "rationale": string, "newsHook": string|null, "opener": string, "flow": string[] (3-5 beats) } ] — same three angles as email;',
    '    "anticipatedObjections": [{ "objection": string, "response": string }] (2-3).',
    "  },",
    '  "sourceOfWealth": { "likelyCategories": string[] (category ids from the reference that most likely apply), "questions": [{ "question": string, "why": string, "suggestedAnswer": string, "expectedEvidence": string[] }] (5-6) }.',
    "For each SoW question, `suggestedAnswer` is the anticipated answer inferred from the research/profile (the RM validates it with the client) and `expectedEvidence` lists the corroborating documents.",
  ].join("\n");
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function parseRead(raw: unknown): MarketRead {
  const r = (raw ?? {}) as Record<string, unknown>;
  const keyFacts = Array.isArray(r.keyFacts)
    ? (r.keyFacts as Record<string, unknown>[])
        .map((f) => ({ label: str(f.label), value: str(f.value) }))
        .filter((f) => f.value.trim().length > 0)
    : [];
  const themes: ReadTheme[] = Array.isArray(r.themes)
    ? (r.themes as Record<string, unknown>[])
        .map((t): ReadTheme => {
          const id = THEME_IDS.includes(t.id as never) ? (t.id as ReadTheme["id"]) : "origin";
          const facts: ReadFact[] = Array.isArray(t.facts)
            ? (t.facts as Record<string, unknown>[])
                .map((f) => ({
                  text: str(f.text),
                  basis: f.basis === "supported" ? ("supported" as const) : ("inference" as const),
                }))
                .filter((f) => f.text.trim().length > 0)
            : [];
          return {
            id,
            heading: str(t.heading) || THEME_DEFAULTS[id],
            takeaway: str(t.takeaway),
            facts,
          };
        })
        .filter((t) => t.takeaway.trim().length > 0 || t.facts.length > 0)
    : [];
  return { headline: str(r.headline), keyFacts, themes };
}

function parseObjections(v: unknown): { objection: string; response: string }[] {
  return Array.isArray(v)
    ? (v as Record<string, unknown>[])
        .map((o) => ({ objection: str(o.objection), response: str(o.response) }))
        .filter((o) => o.objection.trim().length > 0)
    : [];
}

function parseApproach(raw: unknown): Approach {
  const a = (raw ?? {}) as Record<string, unknown>;
  const email: EmailVariant[] = Array.isArray(a.email)
    ? (a.email as Record<string, unknown>[])
        .map((e, i) => ({
          id: str(e.id) || `email-${i + 1}`,
          label: str(e.label) || `Variant ${i + 1}`,
          rationale: str(e.rationale),
          newsHook: str(e.newsHook) || undefined,
          subject: str(e.subject),
          body: str(e.body),
        }))
        .filter((e) => e.body.trim().length > 0 || e.subject.trim().length > 0)
    : [];
  const call: CallVariant[] = Array.isArray(a.call)
    ? (a.call as Record<string, unknown>[])
        .map((c, i) => ({
          id: str(c.id) || `call-${i + 1}`,
          label: str(c.label) || `Variant ${i + 1}`,
          rationale: str(c.rationale),
          newsHook: str(c.newsHook) || undefined,
          opener: str(c.opener),
          flow: strArr(c.flow),
        }))
        .filter((c) => c.opener.trim().length > 0 || c.flow.length > 0)
    : [];
  return { email, call, anticipatedObjections: parseObjections(a.anticipatedObjections) };
}

/** Flat string for verification + legacy display. */
function deriveMarketRead(read: MarketRead): string {
  return [
    read.headline,
    ...read.keyFacts.map((f) => `${f.label}: ${f.value}`),
    ...read.themes.flatMap((t) => [`${t.heading}: ${t.takeaway}`, ...t.facts.map((f) => f.text)]),
  ]
    .filter((s) => s.trim().length > 0)
    .join("\n");
}

/** Legacy cold-call shape, derived from the first call variant. */
function deriveColdCall(approach: Approach): ColdCallScript {
  const first = approach.call[0];
  return {
    opener: first?.opener ?? "",
    talkingPoints: first?.flow ?? [],
    anticipatedObjections: approach.anticipatedObjections,
  };
}

export type ParsedPrep = Pick<
  PrepPack,
  "read" | "approach" | "marketRead" | "coldCall" | "sourceOfWealth"
>;

/** Parse the writer's JSON reply into a structured pack. Returns null if the
 * response isn't valid JSON at all (caller treats that as a draft failure). */
export function parsePrepResponse(text: string): ParsedPrep | null {
  let raw: Record<string, unknown>;
  try {
    const s = text.indexOf("{");
    const e = text.lastIndexOf("}");
    raw = JSON.parse(s >= 0 && e >= 0 ? text.slice(s, e + 1) : text);
  } catch {
    return null;
  }

  const read = parseRead(raw.read);
  const approach = parseApproach(raw.approach);
  const sow = (raw.sourceOfWealth ?? {}) as Record<string, unknown>;
  const questions: SowQuestion[] = Array.isArray(sow.questions)
    ? (sow.questions as Record<string, unknown>[])
        .map((q) => ({
          question: str(q.question),
          why: str(q.why),
          suggestedAnswer: str(q.suggestedAnswer),
          expectedEvidence: strArr(q.expectedEvidence),
        }))
        .filter((q) => q.question.trim().length > 0)
    : [];

  return {
    read,
    approach,
    marketRead: deriveMarketRead(read),
    coldCall: deriveColdCall(approach),
    sourceOfWealth: { likelyCategories: strArr(sow.likelyCategories), questions },
  };
}
