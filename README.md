# End-to-End Prospect Portal — Source of Wealth Tool

An interactive private-banking workspace where a relationship manager runs the full prospect lifecycle — **Identify → Cold Call → Brief → Meet → Onboard** — and creates a per-client Source of Wealth (SoW) assessment with autosave, completion tracking, document checklists and print/export.

It also includes a **deep-research + cross-model verification pipeline** (`@workspace/research-pipeline`): _deep research → Claude writes → OpenAI verifies → banker validates._

## Running locally

Prerequisites: Node.js 24+, pnpm (`corepack enable`), a Postgres database.

```bash
pnpm install
pnpm run typecheck                              # typecheck all packages

# API server (port 5000)
DATABASE_URL=postgres://… OPENAI_API_KEY=sk-… \
  pnpm --filter @workspace/api-server run dev

# Frontend (Vite dev server; proxies /api → http://localhost:5000)
pnpm --filter @workspace/sow-tool run dev
```

Other commands:
- `pnpm run build` — typecheck + build all packages.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod from the OpenAPI spec.
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only).

## Environment

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string (required). |
| `OPENAI_API_KEY` | OpenAI key (required for AI features). `OPENAI_BASE_URL` optional for a gateway. _(Legacy `AI_INTEGRATIONS_OPENAI_*` names still honoured.)_ |
| `ANTHROPIC_API_KEY` | Enables the Claude writer. Without it the OpenAI writer is used. |
| `SOW_WRITER_PROVIDER` | `anthropic`\|`openai` — force the writer; defaults to Claude when `ANTHROPIC_API_KEY` is set. |
| `SOW_WRITER_MODEL` / `SOW_WRITER_MODEL_OPENAI` / `SOW_VERIFIER_MODEL` | Model overrides (defaults: `claude-sonnet-4-6` / `gpt-5.4` / `gpt-5.4`). |
| `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` | Robust SERP search for deep research. |
| `JINA_API_KEY` | Clean markdown extraction (`r.jina.ai`) for deep research. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Service-account key for object storage (optional; storage routes only). |

All AI/search keys are optional and **degrade gracefully** — with no DataForSEO/Jina the model's own web search is used; with no Anthropic key the OpenAI writer is used.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 · DB: PostgreSQL + Drizzle ORM · Validation: Zod + drizzle-zod
- API codegen: Orval (from the OpenAPI spec) · Frontend: React 19 + Vite + Tailwind + Radix · Build: esbuild

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml` → codegen produces hooks (`@workspace/api-client-react`) and Zod (`@workspace/api-zod`)
- DB schema: `lib/db/src/schema/{assessments,prospects}.ts`
- API routes: `artifacts/api-server/src/routes/`
- Frontend app: `artifacts/sow-tool/` (Journey `/`, Workspace `/assessment/:id`, Pipeline `/prospecting`, Prospect `/prospect/:id`)
- **Research/verification pipeline: `lib/research-pipeline/`** — `deepResearch` (multi-angle DataForSEO+Jina fan-out across wealth/corporate/trusts & foundations/offshore/philanthropy/deals), `verify/*` (cross-model claim verification), `write/*` (Claude/OpenAI writer), `reference/sowEvidence` (how private banks frame SoW), `sources/deepDiveSources` (authoritative UHNW registries).
- Questionnaire content: `artifacts/sow-tool/src/lib/sowCatalog.ts` · Prospecting: `prospectingCatalog.ts`

## Architecture decisions

- All questionnaire answers, doc-checklist states and the banker's "applicable categories" live in a single `data` jsonb column on `assessments`, keyed by catalog ids. The frontend owns the shape; the backend persists the blob. Prospects mirror this (`data` jsonb + `briefing` jsonb + `convertedAssessmentId`). `prospect.data` is also where the deep-research **prep pack** is stored (`data.prep`).
- `reviewType`/`riskRating` map DB `null` → `undefined` via a `serialize` helper so response parsing passes.
- `PUT /assessments/:id` is autosave + sign-off; an empty body is a safe no-op.
- `POST /prospects/:id/convert` runs select-check + insert + update in one transaction with `SELECT … FOR UPDATE`; a second convert returns 409. Carries profile/segment/briefing (and any prospect-stage file note) into the new assessment.
- **AI flows** — the briefing, the SoW statement draft and the prep generator all run through the pipeline: deep research grounds the writer (Claude when configured), then an independent OpenAI pass verifies each claim against the source material (supported / inference / unsupported). Verification is non-fatal and `no-fabrication` is enforced both in the prompt and by the verify pass.
- `POST /source-of-wealth/draft` returns six narrative sections; an all-empty statement is a valid 200. `POST /prospects/:id/prep` returns a cold-call script, SoW questions with anticipated answers + expected evidence, and a market read.

## Product

- **Journey home** (`/`): every relationship (prospects + assessments) on one 5-stage rail, derived on the frontend (`lib/journey.ts`) — a Next-Actions worklist, per-stage counts, filters.
- **Prospect workspace**: deep-research **prep pack** (name in → cold call + SoW questions/answers + market read), cold-call script, AI pre-meeting briefing (deep research, sources, verification), the systematic prospecting brief, file note, convert-to-assessment.
- **Assessment workspace**: sectioned SoW questionnaire (statement, wealth categories + doc checklists, source of funds, plausibility, red flags, sign-off), debounced autosave, completion %, status/risk, print/export.
- **Meeting File Note** (shared): free-form note → AI "rewrite/enhance into a professional note", 8-dimension coverage grid.

## Gotchas

- One Meeting File Note per file (single `fileNote` blob; a second meeting overwrites).
- The File Note "Enhance" pass only receives coverage dimensions explicitly engaged AND non-null (`isCovered`) so the AI never fabricates an unconfirmed "fact" into a regulator-facing note.
