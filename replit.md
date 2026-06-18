# Source of Wealth Tool

An interactive private-banking workspace where a relationship manager creates a per-client Source of Wealth (SoW) assessment, works through the full due-diligence questionnaire with autosave, tracks completion and document checklists, and exports/prints the finished file.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- OpenAI (existing): `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`
- Research/verification pipeline (`@workspace/research-pipeline`) — all optional; features degrade gracefully when keys are absent:
  - `ANTHROPIC_API_KEY` — enables the Claude writer for the SoW statement. Without it the existing OpenAI writer is used.
  - `SOW_WRITER_PROVIDER` (`anthropic`|`openai`) — force the writer; defaults to Claude when `ANTHROPIC_API_KEY` is set, else OpenAI.
  - `SOW_WRITER_MODEL` (default `claude-sonnet-4-6`), `SOW_VERIFIER_MODEL` (default `gpt-5.4`).
  - `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` — robust SERP search; `JINA_API_KEY` — clean markdown extraction. Used by `retrieve()` (robust-search layer, ready to wire into the briefing / name-in prep generator).

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml` → codegen produces hooks (`@workspace/api-client-react`) and Zod (`@workspace/api-zod`)
- DB schema: `lib/db/src/schema/assessments.ts`, `lib/db/src/schema/prospects.ts`
- API routes: `artifacts/api-server/src/routes/assessments.ts`, `artifacts/api-server/src/routes/prospects.ts`
- Frontend app: `artifacts/sow-tool/` (Journey home `/`, Workspace `/assessment/:id`, Pipeline `/prospecting`, Prospect `/prospect/:id`)
- Journey derivation (source of truth for the unified home): `artifacts/sow-tool/src/lib/journey.ts` (`buildJourney`, `stageCounts`, 5-stage map)
- Questionnaire content (source of truth): `artifacts/sow-tool/src/lib/sowCatalog.ts`
- Prospecting content (source of truth): `artifacts/sow-tool/src/lib/prospectingCatalog.ts` (systematic-brief sections + the `coldCallScript` talk track and `coldCallCapture` log fields)
- Completion calc: `artifacts/sow-tool/src/lib/progress.ts`
- AI (OpenAI Responses API + live web_search): `lib/integrations-openai-ai-server`, used by the briefing route
- Meeting File Note (shared across prospect + assessment): catalog `artifacts/sow-tool/src/lib/fileNoteCatalog.ts` (meeting types, 8 colour-coded coverage dimensions, `NULL_VALUES`/`isCovered`, shared `engagedCoverage` helper), panel `artifacts/sow-tool/src/components/file-note-panel.tsx`, AI route `artifacts/api-server/src/routes/fileNotes.ts`
- Source of Wealth statement (assessment Section 1): catalog `artifacts/sow-tool/src/lib/sowCatalog.ts` (`sowStatementFields`, `sowAdditionalField`, `sowRequiredFieldIds`, `sowDraftedFieldIds`), component `artifacts/sow-tool/src/components/source-of-wealth-section.tsx`, AI route `artifacts/api-server/src/routes/sourceOfWealth.ts`

## Architecture decisions

- All questionnaire answers, document-checklist states, and the banker's "applicable categories" selection are stored in a single `data` jsonb column on `assessments`, keyed by the catalog item ids. The frontend owns the shape; the backend just persists the blob. This keeps the schema stable as the questionnaire evolves.
- `reviewType`/`riskRating` are optional (not nullable) in the OpenAPI contract; routes map DB `null` → `undefined` via a `serialize` helper so response parsing passes.
- `PUT /assessments/:id` is the autosave + sign-off endpoint; an empty update body is a safe no-op (returns the current record) rather than an error.
- The document checklist uses string states from `documentStates`: `not_applicable | outstanding | received | verified`.
- Prospects mirror the assessments pattern: a single `data` jsonb blob (keyed by `prospectingCatalog` ids) plus a `briefing` jsonb and a `convertedAssessmentId` pointer. The frontend owns the data shape.
- The AI briefing route (`POST /prospects/:id/briefing`) calls the OpenAI Responses API with the `web_search` tool, parses the model's JSON, collects `url_citation` annotations as sources, and rejects empty output (502) rather than persisting a hollow briefing.
- `POST /prospects/:id/convert` runs select-check + insert-assessment + update-prospect inside one transaction with a `SELECT … FOR UPDATE` row lock, so concurrent converts can't create duplicate assessments; a second convert returns 409. The new assessment carries the prospect profile/segment/briefing into its `data` blob. It also lifts any prospect-stage `fileNote` to the top level of the new assessment's `data` so the Meeting File Note survives conversion.
- The Meeting File Note is persisted in the same `data` jsonb blob under a single `fileNote` key (frontend owns the shape `{meetingType,date,note,coverage}`). `calculateProgress` ignores it (counts only catalog ids), so it never affects completion %.
- `POST /file-notes/rewrite` is one stateless AI endpoint: no `coverage` ⇒ "rewrite into professional format"; `coverage` present ⇒ "enhance". Both paths share a `NOTE_STRUCTURE` constant and produce the **same** fully-formatted professional note — enhance is not a light annotation pass, it re-runs the full reformat while weaving in the confirmed coverage (and is told to retain every fact from the draft). Mirrors the briefing route's OpenAI Responses usage but without the `web_search` tool. Rejects empty model output (502).
- `POST /source-of-wealth/draft` (operationId `draftSourceOfWealth`) is a stateless AI endpoint that synthesises a regulator-facing Source of Wealth statement from the meeting note (+ engaged coverage) and the optional carried-over briefing. It returns six narrative sections (`overview`, `employment`, `compensation`, `assetGrowth`, `wealthEvents`, `plausibility`). Mirrors the file-note route's OpenAI Responses usage (no web_search): validates with safeParse→400, requires a note OR a briefing (else 400), parses the model JSON defensively (brace-slice), coerces each of the six keys to a trimmed string. An **all-empty statement returns 200** (a legitimate "the inputs gave no basis" result the UI guides the banker through); 502 is reserved for genuine model/parse failures. No-fabrication is enforced in the prompt — sections with no basis come back empty and inferences are framed as plausibility.

## Product

- Journey home (`/`): one continuous end-to-end view of every relationship (prospects + onboarding assessments) on a single 5-stage rail — Identify → Cold Call → Brief → Meet → Onboard. Derived purely on the frontend (no backend stage column) via `lib/journey.ts`: a "Next Actions" worklist, live per-stage counts, stage filters, overview-derived metrics, and both Add Prospect / New Assessment dialogs. Replaces the former separate Dashboard + Prospecting landing areas.
- Assessment workspace: sectioned questionnaire (Source of Wealth statement, applicable wealth categories with per-document checklists, source of funds, plausibility checks, red flags, sign-off, master checklist), debounced autosave, live completion %, status/risk controls, export/print, delete.
- Prospecting: pipeline overview (totals, briefed, converted) and a prospect list; create prospects.
- Meeting File Note (shared, on both the prospect file and the client assessment): banker writes a free-form note (with word count), then runs a server-side AI "Rewrite in professional format" (preview → accept/retry/dismiss). A colour-coded 8-dimension "Discussion coverage" grid (icons + guidance hints) prompts what a complete meeting touches; marking topics enables an "Enhance" pass that re-runs the full professional reformat AND weaves the confirmed details in (so the result is a clean, complete note, not a lightly-annotated draft). Copy + print-friendly. One note per file.
- Source of Wealth statement (assessment workspace, Section 1): replaces the former 11 manual `profile.*` fields. The banker keeps the Client Reference / RM header, then drafts a regulator-facing narrative of how the client built their wealth — six sections (wealth origin, employment income, compensation, asset growth, wealth events, plausibility & corroboration) synthesised by the `source-of-wealth/draft` AI endpoint from the meeting note (+ engaged coverage) and the carried-over briefing. Preview → accept flow (never a direct fill): the draft is shown for review, and accepting merges the six `sow.*` values + a `sow.generatedAt` timestamp into the assessment `data` blob via one batched autosave. Sections are then freely editable (debounced autosave); empty sections show guidance, and an all-empty draft surfaces a "no basis" message rather than an error. A manual "Additional information" field below the document is never AI-generated. Only `sow.overview` and `sow.plausibility` count toward completion.
- Prospect workspace: an end-to-end flow — (1) a cold-call script (structured talk track, live-personalised with the prospect name/RM/anchor, plus call-outcome log fields); (2) an AI pre-meeting briefing (live web search) showing summary, talking points, referral routes, recommended approach and cited sources; the systematic prospecting brief (5 profile dimensions, 3 channels, 4 operational questions) with debounced autosave; print; and (3) convert to a client SoW assessment (whose questionnaire is itself the meeting question guide).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- One Meeting File Note per file: a second meeting overwrites the first (single `fileNote` blob). Separate per-meeting notes would need a new keyed shape.
- The File Note "Enhance" pass must only receive coverage dimensions the banker explicitly engaged with AND whose value is non-null (`isCovered`). Sending a defaulted-but-non-null dropdown (e.g. Relationship Temperature's "Strong and growing") would feed the AI an unconfirmed "fact" that it fabricates into a regulator-facing note. `runEnhance` filters to `!!entry && isCovered(entry.value)` (matching the print summary); the prompt's "ignore Not discussed" line is only a backstop.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
