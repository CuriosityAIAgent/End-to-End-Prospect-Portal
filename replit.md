# Source of Wealth Tool

An interactive private-banking workspace where a relationship manager creates a per-client Source of Wealth (SoW) assessment, works through the full due-diligence questionnaire with autosave, tracks completion and document checklists, and exports/prints the finished file.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml` → codegen produces hooks (`@workspace/api-client-react`) and Zod (`@workspace/api-zod`)
- DB schema: `lib/db/src/schema/assessments.ts`
- API routes: `artifacts/api-server/src/routes/assessments.ts`
- Frontend app: `artifacts/sow-tool/` (Dashboard `/`, Workspace `/assessment/:id`)
- Questionnaire content (source of truth): `artifacts/sow-tool/src/lib/sowCatalog.ts`
- Completion calc: `artifacts/sow-tool/src/lib/progress.ts`

## Architecture decisions

- All questionnaire answers, document-checklist states, and the banker's "applicable categories" selection are stored in a single `data` jsonb column on `assessments`, keyed by the catalog item ids. The frontend owns the shape; the backend just persists the blob. This keeps the schema stable as the questionnaire evolves.
- `reviewType`/`riskRating` are optional (not nullable) in the OpenAPI contract; routes map DB `null` → `undefined` via a `serialize` helper so response parsing passes.
- `PUT /assessments/:id` is the autosave + sign-off endpoint; an empty update body is a safe no-op (returns the current record) rather than an error.
- The document checklist uses string states from `documentStates`: `not_applicable | outstanding | received | verified`.

## Product

- Dashboard: portfolio overview (totals, breakdown by status and risk, recently updated) and a list of client assessments with completion progress; create new assessments.
- Assessment workspace: sectioned questionnaire (profile, applicable wealth categories with per-document checklists, source of funds, plausibility checks, red flags, sign-off, master checklist), debounced autosave, live completion %, status/risk controls, export/print, delete.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
