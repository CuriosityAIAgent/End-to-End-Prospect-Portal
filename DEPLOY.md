# Deploying to Vercel

This app was originally built for Replit (single Express process + managed
Postgres + a credential sidecar). It now deploys on Vercel as:

- **Static SPA** — `artifacts/sow-tool` built by Vite → `artifacts/sow-tool/dist/public`
- **Serverless API** — the Express app (`artifacts/api-server/src/app.ts`) re-exported
  from `api/[...path].ts`, which Vercel runs as a Node function for every `/api/*` request
- **External Postgres** — Supabase (the Replit-managed DB is gone)

`vercel.json` wires the build command, output directory, and the SPA fallback
rewrite (everything except `/api/*` falls through to `index.html` for client-side
routing).

## 1. Provision the database (Supabase)

1. Create a Supabase project (or reuse one — use a dedicated schema/database).
2. In **Project Settings → Database → Connection string**, copy the
   **Transaction pooler** URI (host `...pooler.supabase.com`, port **6543**).
   Serverless functions open many short-lived connections, so the pooled
   (pgBouncer) string is required — the direct 5432 string will exhaust
   connections under load.
   It looks like:
   `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`

3. Push the schema (run locally, one-time, with the **direct** 5432 URL — pgBouncer
   doesn't support DDL/prepared statements well):
   ```bash
   # PowerShell
   $env:DATABASE_URL="postgresql://postgres.<ref>:<pwd>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   pnpm --filter @workspace/db run push
   ```

## 2. Set environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | Value |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Supabase **transaction pooler** URI (port 6543) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | ✅ (for AI features) | Your OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | ✅ (for AI features) | `https://api.openai.com/v1` |
| `NODE_ENV` | auto | Vercel sets `production` (keeps pino JSON logging, no worker threads) |
| `LOG_LEVEL` | optional | `info` (default) |

AI features = the prospect briefing, file-note rewrite, Source-of-Wealth draft,
and transcription routes. The app boots without the OpenAI vars; those routes
just fail until the key is set.

## 3. Connect the repo & deploy

1. Import `RupesWatson/End-to-End-Prospect-Portal` as a new Vercel project (do **not**
   reuse the old `end-to-end-prospect-portal-api-server` projects — they're
   misconfigured; delete them once this works).
2. Leave the build settings to `vercel.json` (Framework: Other; it reads the file).
   Root Directory: repository root.
3. Deploy from the `vercel-migration` branch (or merge it to `main` first).

## Object storage (currently dormant)

`/api/storage/*` still references the old Replit GCS sidecar
(`artifacts/api-server/src/lib/objectStorage.ts`, `http://127.0.0.1:1106`). The
**core product does not use it** (verified — no upload calls in the SoW tool), so
the app runs fine without it. If you later add file uploads, replace that file's
credential setup with explicit Google Cloud Storage credentials, Vercel Blob, or
S3, and set `PUBLIC_OBJECT_SEARCH_PATHS` / `PRIVATE_OBJECT_DIR`.

## Notes / first-deploy caveats

- The API runs as one Node serverless function bundling the Express app. The
  first deploy may surface a bundling or module-resolution issue specific to the
  monorepo; check the Vercel **build logs** and **runtime logs** and iterate.
- `pg.Pool` is created per warm function instance. If you see connection limits,
  cap it via `new Pool({ connectionString, max: 1 })` in `lib/db/src/index.ts`.
- Node version: Vercel's default Node runtime is used (the code targets Node 24
  but runs on 20/22). Pin via Project Settings if needed.
