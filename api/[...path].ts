// Vercel serverless entry for the API.
//
// Vercel invokes this catch-all function for every `/api/*` request and passes
// the original URL (e.g. `/api/assessments`) straight through to the Express
// app, which mounts all routes under `/api` (see artifacts/api-server/src/app.ts).
//
// The app reads its config from environment variables at runtime — set these in
// the Vercel project settings (see ARCHITECTURE.md / DEPLOY.md):
//   DATABASE_URL, AI_INTEGRATIONS_OPENAI_API_KEY, AI_INTEGRATIONS_OPENAI_BASE_URL
//
// Object-storage routes (/api/storage/*) are dormant until GCS/Blob creds are
// wired up; the core product (assessments, prospects, file notes, SoW drafts,
// transcription) does not use them.
import app from "../artifacts/api-server/src/app";

export default app;
