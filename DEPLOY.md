# Deploying

This is a **pnpm monorepo with one runtime service**. Almost every `@workspace/*`
package is an internal build-time library (types, db schema, generated client,
integrations) or a dev artifact (`mockup-sandbox`, `sow-overview-video`) — they
are **not** deployable apps. They are compiled into the single service.

**Deploy exactly one service + one database:**

| Package | Role | Runs in production? |
|---|---|---|
| `@workspace/api-server` | Express API; also serves the built frontend | ✅ the only service |
| `@workspace/sow-tool` | React frontend → static build served by api-server | ❌ built, not run |
| `db`, `api-spec`, `api-zod`, `api-client-react`, `research-pipeline`, `integrations-*` | Build-time libraries | ❌ |
| `mockup-sandbox`, `sow-overview-video` | Dev sandbox / promo video | ❌ |

> ⚠️ If a host (e.g. Railway's monorepo graph) auto-detects every workspace
> package as a service, **don't** deploy them all. Configure a single service
> as below and discard the rest.

## Railway (single service)

1. **New Project → Deploy from GitHub** → this repo. (Root directory = repo
   root — pnpm needs the whole workspace to build.)
2. **Add → Database → PostgreSQL** → injects `DATABASE_URL` automatically.
3. The single service's build/start come from [`railway.toml`](railway.toml):
   - **Build:** `pnpm run build:deploy` — compiles the frontend (`artifacts/sow-tool/dist/public`) and the API bundle.
   - **Start:** `pnpm run start:deploy` — pushes the schema **only if `DATABASE_URL` is set**, then serves `/api` **and** the frontend on one URL. The core app boots and serves even with no database yet (DB endpoints 500 until Postgres is provisioned).
4. **Service → Variables** — set the keys below.
5. Deploy. One service, one URL, one database.

### If the build fails with "No start command detected"

Railway's builder (Railpack) didn't apply the config. Two fixes:

- **Don't pin a builder.** `railway.toml` must NOT set `[build].builder` to
  `nixpacks`/anything — that makes Railpack ignore `buildCommand`/`startCommand`
  and try (and fail) to auto-detect a start command in the 11-package workspace.
  This repo's `railway.toml` is already correct (no `builder` line).
- **Or set the commands in the dashboard** (these always win). Service →
  **Settings**:
  - **Root Directory:** `/` (repo root — pnpm needs the whole workspace).
  - **Build Command:** `pnpm run build:deploy`
  - **Start Command:** `pnpm run db:push && pnpm run start`

If the service was auto-created by Railway's monorepo graph (a per-package
service), delete it and add **one** service from the repo root instead.

## Environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | for data | Postgres (Railway Postgres plugin). The app **boots without it** — prospect/assessment endpoints 500 until it's set. |
| `PORT` | — | Provided by the host. |
| `OPENAI_API_KEY` | ✅ | OpenAI (verification + the default writer). `OPENAI_BASE_URL` optional. |
| `ANTHROPIC_API_KEY` | recommended | Enables the Claude writer; without it the OpenAI writer is used. |
| `DATAFORSEO_LOGIN` + `DATAFORSEO_PASSWORD` | recommended | Robust SERP search for deep research. |
| `JINA_API_KEY` | recommended | Clean markdown extraction for deep research. |
| `SOW_VERIFIER_MODEL` / `SOW_WRITER_MODEL_OPENAI` / `FILE_NOTE_MODEL` | optional | OpenAI model overrides (defaults: `gpt-4o-mini` verifier / `gpt-4o` writer-fallback / `gpt-4o` file-note). Set to a newer OpenAI model if you prefer. |
| `SOW_WRITER_MODEL` | optional | Claude model id (default `claude-sonnet-4-6`). |
| `WEB_DIST` | optional | Override the static-frontend path (default `artifacts/sow-tool/dist/public`). |
| `GOOGLE_APPLICATION_CREDENTIALS` | optional | Only for the object-storage routes (standard GCS). |

All AI/search keys degrade gracefully: with no DataForSEO/Jina the model's own
web search is used; with no Anthropic key the OpenAI writer is used.

## Other hosts

Any Node host works the same way — it's a standard pnpm app:

```bash
pnpm install
pnpm run build:deploy            # frontend + API
DATABASE_URL=… OPENAI_API_KEY=… pnpm run db:push   # once, to create tables
DATABASE_URL=… OPENAI_API_KEY=… PORT=8080 pnpm run start
```

The server then serves the app and the API on `PORT`.
